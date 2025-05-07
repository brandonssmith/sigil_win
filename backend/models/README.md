# Models

This directory is the default location for storing Hugging Face transformer models that can be loaded by Sigil.

## ⬇️ Downloading Models

Sigil provides an in-application interface to search for and download models directly from the Hugging Face Hub.

-   **Search**: Use the search functionality within the application to find models.
-   **Download**: Initiate downloads through the UI. Models will be saved to this `models/` directory by default, organized by their Hugging Face repository name (e.g., `google--flan-t5-small`).
-   **Automatic Loading**: Once downloaded here, models can typically be loaded by their name directly in the Sigil interface.

Alternatively, you can manually place model directories here. Ensure each model's directory contains all necessary files (e.g., `*.safetensors` or `pytorch_model.bin`, `config.json`, `tokenizer.json`).

For more detailed instructions on application usage, please refer to the [main README](../../README.md).

<a name="top"></a>

[Back to Top](#top)
