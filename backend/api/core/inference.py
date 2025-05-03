import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

def generate_response(
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    device: str,
    prompt: str,
    temperature: float,
    top_p: float,
    max_new_tokens: int,
) -> str:
    """Generates a response string using the provided model and parameters."""
    try:
        # Store original device
        original_device = device
        inference_device = device
        
        # Check if we need to move to CPU for inference due to MPS issues
        if device == 'mps':
            print("   ⚠️ MPS device detected. Moving model and inputs to CPU for generation.")
            inference_device = 'cpu'
            model.to(inference_device) # Move model to CPU

        # Move inputs to the chosen inference device (CPU or original MPS/CUDA)
        inputs = tokenizer(prompt, return_tensors="pt").to(inference_device)
        input_ids = inputs["input_ids"]
        attention_mask = inputs.get("attention_mask")
        input_length = input_ids.shape[1]

        # --- Removed MPS cache clearing as we're moving to CPU ---
        # if device == 'mps':
        #     torch.mps.empty_cache()
        # --- End MPS cache clearing ---

        print("--- Debug: Inference Parameters ---")
        print(f"   Prompt (first 100 chars): {prompt[:100]}...")
        print(f"   Temperature: {temperature}")
        print(f"   Top P: {top_p}")
        print(f"   Max New Tokens: {max_new_tokens}")
        print(f"   Inference Device: {inference_device}")
        print("------------------------------------")

        with torch.no_grad():
            outputs = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                top_k=50, # Keep default top_k
                top_p=top_p,
                pad_token_id=tokenizer.pad_token_id
            )

        # --- Debug: Token Count ---
        total_tokens = outputs[0].shape[0]
        generated_tokens = total_tokens - input_length
        print(f"   Tokens in prompt: {input_length}")
        print(f"   Tokens generated: {generated_tokens} (limit {max_new_tokens})")
        print("------------------------------------")
        # --- End Debug ---

        generated_ids = outputs[0][input_length:]
        # Decode on CPU is fine
        response_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        
        # --- Move model back to original device if it was moved ---
        if original_device == 'mps' and inference_device == 'cpu':
             print("   ✅ Generation complete. Moving model back to MPS.")
             model.to(original_device)
        # --- End move back ---
             
        return response_text

    except Exception as e:
        # Re-raise exceptions to be handled by the calling endpoint
        print(f"Error during core generation: {e}") # Log error here
        raise e 