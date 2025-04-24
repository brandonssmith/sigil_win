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
        inputs = tokenizer(prompt, return_tensors="pt").to(device)
        input_ids = inputs["input_ids"]
        attention_mask = inputs.get("attention_mask")
        input_length = input_ids.shape[1]

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

        generated_ids = outputs[0][input_length:]
        response_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        return response_text

    except Exception as e:
        # Re-raise exceptions to be handled by the calling endpoint
        print(f"Error during core generation: {e}") # Log error here
        raise e 