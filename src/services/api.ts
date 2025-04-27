const API_BASE_URL = 'http://localhost:8000'; // Adjust if needed

export async function validateToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/validate_token`);
        if (!response.ok) {
            console.error(`Token validation failed: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Network error validating token:', error);
        return null;
    }
}

export async function searchModels(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/search_models?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error searching models:', error);
        throw error;
    }
}

export async function checkGated(modelId) {
     try {
        const response = await fetch(`${API_BASE_URL}/models/${encodeURIComponent(modelId)}/gated_status`);
         if (!response.ok) {
             throw new Error(`Gated check failed: ${response.statusText}`);
         }
        const data = await response.json();
        return { modelId, isGated: data.isGated };
     } catch (error) {
         console.error(`Error checking gated status for ${modelId}:`, error);
         throw error;
     }
}


export async function requestDownload(modelId) {
     try {
        const response = await fetch(`${API_BASE_URL}/download_model`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model_name: modelId }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Download request failed: ${response.statusText}`);
         }
        return data;
     } catch (error) {
         console.error(`Error requesting download for ${modelId}:`, error);
         throw error;
     }
} 