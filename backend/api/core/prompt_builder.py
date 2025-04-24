from transformers import AutoTokenizer
from typing import Optional, List, Dict

# --- Helper Function for Prompt Generation ---
def generate_prompt(
    mode: str,
    system_prompt: str,
    tokenizer: AutoTokenizer,
    message: Optional[str] = None,
    messages: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Generates the appropriate prompt string based on the mode."""
    if mode == "instruction":
        if not message:
            raise ValueError("Message is required for 'instruction' mode.")
        # Use apply_chat_template for instruction mode as well for consistency
        # Create a minimal message list for instruction mode
        instruction_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        prompt = tokenizer.apply_chat_template(
            instruction_messages,
            tokenize=False,
            add_generation_prompt=True # Ensures the assistant prompt is added correctly
        )
    elif mode == "chat":
        if not messages:
            raise ValueError("Messages list is required for 'chat' mode.")
        # Prepend system prompt if not already present or update if it is
        if not messages or messages[0].get("role") != "system":
            chat_messages_with_system = [{"role": "system", "content": system_prompt}] + messages
        else:
            # Update existing system prompt if provided, otherwise keep the one from history
            chat_messages_with_system = messages
            chat_messages_with_system[0]["content"] = system_prompt

        prompt = tokenizer.apply_chat_template(
            chat_messages_with_system,
            tokenize=False,
            add_generation_prompt=True # Ensures the assistant prompt is added correctly
        )
    else:
        raise ValueError("Invalid mode specified for prompt generation.")

    # Optional: Print the generated prompt for debugging
    # print(f"\n--- Generated Prompt (Mode: {mode}) --- \n{prompt}\n--------------------------------\n")
    return prompt 