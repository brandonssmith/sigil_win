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
    # Detect prompt handling mode attached to tokenizer by model_loader
    prompt_mode = getattr(tokenizer, "prompt_mode", "template")
    custom_cfg = getattr(tokenizer, "custom_prompt_config", None)

    # Helper for very simple fallback prompt
    def build_fallback(single_msg: str) -> str:
        return f"{system_prompt}\n\nUser: {single_msg}\nAssistant:"

    # -----------------------------
    # Build prompt based on modes
    # -----------------------------

    if prompt_mode == "custom" and custom_cfg is not None:
        # Extremely naive implementation: assume simple prefix/suffix config
        sys_pre = custom_cfg.get("system_prefix", "")
        sys_suf = custom_cfg.get("system_suffix", "\n")
        usr_pre = custom_cfg.get("user_prefix", "User: ")
        usr_suf = custom_cfg.get("user_suffix", "\n")
        asst_pre = custom_cfg.get("assistant_prefix", "Assistant: ")
        asst_suf = custom_cfg.get("assistant_suffix", "")

        if mode == "instruction":
            if not message:
                raise ValueError("Message is required for 'instruction' mode.")
            prompt = (
                f"{sys_pre}{system_prompt}{sys_suf}"
                f"{usr_pre}{message}{usr_suf}"
                f"{asst_pre}"
            )
        else:  
            # chat mode
            if not messages:
                raise ValueError("Messages list is required for 'chat' mode.")
            # Prepend system prompt as first message
            convo = messages
            if convo[0].get("role") != "system":
                convo = [{"role": "system", "content": system_prompt}] + convo

            prompt_parts = []
            for m in convo:
                if m["role"] == "system":
                    prompt_parts.append(f"{sys_pre}{m['content']}{sys_suf}")
                elif m["role"] == "user":
                    prompt_parts.append(f"{usr_pre}{m['content']}{usr_suf}")
                else:  # assistant
                    prompt_parts.append(f"{asst_pre}{m['content']}{asst_suf}")
            prompt_parts.append(asst_pre)  # Generation starts
            prompt = "".join(prompt_parts)

        return prompt

    # If tokenizer has a proper chat template, use it
    if prompt_mode == "template":
        template_messages = []
        if mode == "instruction":
            template_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ]
        else:  # chat
            template_messages = (
                [{"role": "system", "content": system_prompt}] + messages
                if (not messages or messages[0].get("role") != "system")
                else messages
            )
        return tokenizer.apply_chat_template(
            template_messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    # Finally, fallback mode (simple prompt)
    if mode == "instruction":
        if not message:
            raise ValueError("Message is required for 'instruction' mode.")
        return build_fallback(message)
    else:
        if not messages:
            raise ValueError("Messages list is required for 'chat' mode.")
        prompt_lines = [system_prompt, ""]
        for m in messages:
            if m["role"] == "user":
                prompt_lines.append(f"User: {m['content']}")
            else:
                prompt_lines.append(f"Assistant: {m['content']}")
        prompt_lines.append("Assistant:")
        return "\n".join(prompt_lines)

    # Should never reach here
    raise ValueError("Failed to build prompt with current configuration.")

    # -----------------------------
    # Old logic (kept for reference)
    # -----------------------------
    # if mode == "instruction":
    #     if not message:
    #         raise ValueError("Message is required for 'instruction' mode.")
    #     # Use apply_chat_template for instruction mode as well for consistency
    #     # Create a minimal message list for instruction mode
    #     instruction_messages = [
    #         {"role": "system", "content": system_prompt},
    #         {"role": "user", "content": message}
    #     ]
    #     prompt = tokenizer.apply_chat_template(
    #         instruction_messages,
    #         tokenize=False,
    #         add_generation_prompt=True # Ensures the assistant prompt is added correctly
    #     )
    # elif mode == "chat":
    #     if not messages:
    #         raise ValueError("Messages list is required for 'chat' mode.")
    #     # Prepend system prompt if not already present or update if it is
    #     if not messages or messages[0].get("role") != "system":
    #         chat_messages_with_system = [{"role": "system", "content": system_prompt}] + messages
    #     else:
    #         # Update existing system prompt if provided, otherwise keep the one from history
    #         chat_messages_with_system = messages
    #         chat_messages_with_system[0]["content"] = system_prompt
    #
    #     prompt = tokenizer.apply_chat_template(
    #         chat_messages_with_system,
    #         tokenize=False,
    #         add_generation_prompt=True # Ensures the assistant prompt is added correctly
    #     )
    # else:
    #     raise ValueError("Invalid mode specified for prompt generation.")
    #
    # # Optional: Print the generated prompt for debugging
    # # print(f"\n--- Generated Prompt (Mode: {mode}) --- \n{prompt}\n--------------------------------\n")
    # return prompt
    # ------------------------------------------------------------- 