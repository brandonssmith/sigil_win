import os
import time
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from pathlib import Path
import gc # For garbage collection

def get_available_models(models_base_dir: str) -> list:
    """Lists subdirectories in the models directory."""
    base_path = Path(models_base_dir).expanduser()
    if not base_path.is_dir():
        print(f"Error: Models directory not found at {base_path}")
        return []
    
    models = [d.name for d in base_path.iterdir() if d.is_dir()]
    return models

def select_model(models: list) -> str | None:
    """Prompts the user to select a model from the list."""
    if not models:
        print("No models available to test.")
        return None
        
    print("Available models:")
    for i, model_name in enumerate(models):
        print(f"  {i + 1}: {model_name}")
        
    while True:
        try:
            choice = input(f"Select a model number (1-{len(models)}): ")
            index = int(choice) - 1
            if 0 <= index < len(models):
                return models[index]
            else:
                print("Invalid choice. Please enter a number from the list.")
        except ValueError:
            print("Invalid input. Please enter a number.")
        except EOFError:
            print("\nSelection cancelled.")
            return None

# --- Main script execution starts below ---
if __name__ == "__main__":
    MODELS_DIR = "~/sigil/backend/models"
    
    available_models = get_available_models(MODELS_DIR)
    selected_model_name = select_model(available_models)
    
    if not selected_model_name:
        exit()
        
    selected_model_path = Path(MODELS_DIR).expanduser() / selected_model_name
    print(f"\nSelected model: {selected_model_name} at {selected_model_path}")

    # --- Device Check ---
    is_cuda = torch.cuda.is_available()
    if is_cuda:
        gpu_name = torch.cuda.get_device_name(0)
        print(f"CUDA Available: True (Device: {gpu_name})")
    else:
        print("CUDA Available: False (Using CPU)")
        
    # --- Test Configuration ---
    PROMPT = "What is the future of AI?"
    MAX_NEW_TOKENS = 20
    
    results = []
    
    print(f"\nLoading tokenizer for {selected_model_name}...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(selected_model_path, local_files_only=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            print("   - Added pad_token = eos_token")
    except Exception as e:
        print(f"Error loading tokenizer: {e}")
        exit()

    print(f"Loading model {selected_model_name} (this may take a while)...")
    try:
        # Load initially onto CPU with fp32
        base_model = AutoModelForCausalLM.from_pretrained(
            selected_model_path, 
            local_files_only=True, 
            torch_dtype=torch.float32 # Start with FP32
        )
        base_model.eval() # Set to evaluation mode
        print("   - Base model loaded to CPU (FP32).")
    except Exception as e:
        print(f"Error loading base model: {e}")
        exit()

    # --- Inference Helper ---
    def run_inference(test_name: str, model, device, dtype, prompt: str, max_tokens: int):
        print(f"\n--- Running Test: {test_name} ({device.upper()}, {str(dtype).split('.')[-1]}) ---")
        output_text = "Error during generation"
        duration = float('inf')
        
        try:
            # Ensure model is on the correct device and dtype
            print(f"   - Moving model to {device.upper()} with {str(dtype).split('.')[-1]}...")
            if dtype == torch.float16:
                 # .half() is a convenience for .to(torch.float16)
                model.half()
            elif dtype == torch.float32:
                 # .float() is a convenience for .to(torch.float32)
                model.float() 
            
            model.to(device)
            print(f"   - Model ready on {device.upper()}.")

            inputs = tokenizer(prompt, return_tensors="pt").to(device)
            
            print("   - Starting generation...")
            start_time = time.perf_counter()
            with torch.no_grad():
                outputs = model.generate(**inputs, max_new_tokens=max_tokens, pad_token_id=tokenizer.pad_token_id)
            end_time = time.perf_counter()
            
            output_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            duration = end_time - start_time
            print(f"   - Generation finished in {duration:.4f} seconds.")
            
        except RuntimeError as e:
            if "expected scalar type Half but found Float" in str(e) or "expected scalar type Float but found Half" in str(e) or "CUDA out of memory" in str(e):
                 print(f"   - Error during {test_name} inference: {e}")
                 print(f"   - Skipping test due to hardware/model limitations.")
                 output_text = f"Skipped ({e})"
                 duration = float('inf') # Indicate failure
            elif "doesn\'t support\" half" in str(e).lower():
                 print(f"   - Model does not support FP16: {e}")
                 print(f"   - Skipping FP16 test.")
                 output_text = "Skipped (FP16 not supported)"
                 duration = float('inf') # Indicate failure
            else:
                 print(f"   - Unexpected runtime error during {test_name} inference: {e}")
                 output_text = f"Error ({e})"
                 duration = float('inf') # Indicate failure
        except Exception as e:
            print(f"   - General error during {test_name} inference: {e}")
            output_text = f"Error ({e})"
            duration = float('inf') # Indicate failure
        finally:
            # Move model back to CPU before next test if it was on GPU
            if device == 'cuda':
                print("   - Moving model back to CPU...")
                model.to('cpu') 
                torch.cuda.empty_cache()
                print("   - Cleared CUDA cache.")
                
        return {
            "mode": test_name,
            "time": duration,
            "output": output_text
        }

    # --- Run Tests ---
    
    # Test 1: CPU FP32
    # Model is already loaded on CPU in FP32
    cpu_fp32_result = run_inference("CPU FP32", base_model, 'cpu', torch.float32, PROMPT, MAX_NEW_TOKENS)
    results.append(cpu_fp32_result)

    # Test 2: GPU FP32
    if is_cuda:
        # Pass the same base_model instance, run_inference will move it
        gpu_fp32_result = run_inference("GPU FP32", base_model, 'cuda', torch.float32, PROMPT, MAX_NEW_TOKENS)
        results.append(gpu_fp32_result)
    else:
        print("\n--- Skipping Test: GPU FP32 (CUDA not available) ---")

    # Test 3: GPU FP16
    if is_cuda:
        # Pass the same base_model instance
        gpu_fp16_result = run_inference("GPU FP16", base_model, 'cuda', torch.float16, PROMPT, MAX_NEW_TOKENS)
        # Only add if not skipped
        if gpu_fp16_result['time'] != float('inf'):
             results.append(gpu_fp16_result)
    else:
        print("\n--- Skipping Test: GPU FP16 (CUDA not available) ---")
        
    # --- Clean up ---
    print("\nCleaning up model and tokenizer...")
    del base_model
    del tokenizer
    gc.collect()
    if is_cuda:
        torch.cuda.empty_cache()
        print("Final CUDA cache clear.")

    # --- Print Summary ---
    print("\n--- Inference Test Summary ---")
    print(f"Model: {selected_model_name}")
    print(f"Prompt: '{PROMPT}'")
    print(f"Max New Tokens: {MAX_NEW_TOKENS}")
    print("----------------------------------------------------------------------")
    print(f"| {'Mode':<12} | {'Time (s)':<10} | {'Output (first 100 chars)':<100} |")
    print("|--------------|------------|------------------------------------------------------------------------------------------------------|")
    for res in results:
        time_str = f"{res['time']:.4f}" if res['time'] != float('inf') else "N/A"
        output_preview = res['output'][:100].replace('\n', ' ') + ('...' if len(res['output']) > 100 else '')
        print(f"| {res['mode']:<12} | {time_str:<10} | {output_preview:<100} |")
    print("------------------------------------------------------------------------------------------------------") 