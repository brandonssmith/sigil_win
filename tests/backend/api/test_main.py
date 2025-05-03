import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os
import sys

# Add the backend directory to the path to allow imports
# This assumes the tests are run from the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../'))
sys.path.insert(0, project_root)

# Now import the app
# We need to potentially adjust this path if the app initialization is complex
# or depends on things not available during testing setup.
# For now, assume direct import works.
try:
    from backend.api.main import app
except ImportError as e:
    pytest.skip(f"Could not import FastAPI app, skipping integration tests: {e}", allow_module_level=True)


client = TestClient(app)

def test_health_check():
    """Test the /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@patch('os.path.isdir')
@patch('os.listdir')
@patch('os.path.abspath')
def test_list_themes_success(mock_abspath, mock_listdir, mock_isdir):
    """Test the /themes endpoint successfully lists themes."""
    # Configure mocks
    mock_abspath.return_value = '/fake/path/to/frontend/public/themes'
    mock_isdir.return_value = True
    mock_listdir.return_value = ['theme1.css', 'theme2.css', 'otherfile.txt']

    response = client.get("/themes")
    assert response.status_code == 200
    assert response.json() == ['theme1', 'theme2']
    mock_abspath.assert_called_once()
    mock_isdir.assert_called_once_with('/fake/path/to/frontend/public/themes')
    mock_listdir.assert_called_once_with('/fake/path/to/frontend/public/themes')

@patch('os.path.isdir')
@patch('os.path.abspath')
def test_list_themes_dir_not_found(mock_abspath, mock_isdir):
    """Test the /themes endpoint when the directory doesn't exist."""
    # Configure mocks
    mock_abspath.return_value = '/fake/path/to/nonexistent'
    mock_isdir.return_value = False

    response = client.get("/themes")
    assert response.status_code == 404
    assert response.json() == {"detail": "Themes directory not found"}
    mock_abspath.assert_called_once()
    mock_isdir.assert_called_once_with('/fake/path/to/nonexistent')


@patch('os.path.isdir')
@patch('os.listdir')
@patch('os.path.abspath')
def test_list_models_success(mock_abspath, mock_listdir, mock_isdir):
    """Test the /models endpoint successfully lists models."""
    # Configure mocks
    models_base_dir = '/fake/path/to/backend/models'
    mock_abspath.return_value = models_base_dir
    # Mock os.path.isdir for the base directory check
    # And also for the checks within the list comprehension
    def isdir_side_effect(path):
        if path == models_base_dir:
            return True # The main models directory exists
        elif path == os.path.normpath(os.path.join(models_base_dir, 'model1')):
            return True # model1 is a directory
        elif path == os.path.normpath(os.path.join(models_base_dir, 'model2')):
            return True # model2 is a directory
        elif path == os.path.normpath(os.path.join(models_base_dir, 'a_file.txt')):
            return False # a_file.txt is not a directory
        return False # Default case

    mock_isdir.side_effect = isdir_side_effect
    mock_listdir.return_value = ['model1', 'model2', 'a_file.txt', '__pycache__']

    response = client.get("/models")

    print(f"Response status: {response.status_code}")
    print(f"Response JSON: {response.json()}")

    assert response.status_code == 200
    assert response.json() == ['model1', 'model2'] # Should only include directories
    mock_abspath.assert_called_once()
    # Check calls to isdir: once for the base path, then for each item listdir returns
    expected_isdir_calls = [
        models_base_dir,
        os.path.normpath(os.path.join(models_base_dir, 'model1')),
        os.path.normpath(os.path.join(models_base_dir, 'model2')),
        os.path.normpath(os.path.join(models_base_dir, 'a_file.txt')),
        os.path.normpath(os.path.join(models_base_dir, '__pycache__'))
    ]
    # Convert call args list to simple paths for comparison
    actual_isdir_calls = [call[0][0] for call in mock_isdir.call_args_list]

    assert actual_isdir_calls[0] == expected_isdir_calls[0] # Check the first call separately
    # Check the subsequent calls (order might vary depending on listdir)
    assert sorted(actual_isdir_calls[1:]) == sorted(expected_isdir_calls[1:])

    mock_listdir.assert_called_once_with(models_base_dir)


@patch('os.path.isdir')
@patch('os.path.abspath')
def test_list_models_dir_not_found(mock_abspath, mock_isdir):
    """Test the /models endpoint when the directory doesn't exist."""
    # Configure mocks
    mock_abspath.return_value = '/fake/path/to/nonexistent/models'
    mock_isdir.return_value = False # The base models directory doesn't exist

    response = client.get("/models")
    assert response.status_code == 404
    assert response.json() == {"detail": "Models directory not found"}
    mock_abspath.assert_called_once()
    mock_isdir.assert_called_once_with('/fake/path/to/nonexistent/models')

# Add more tests here for other endpoints (e.g., /api/v1/model/load, chat endpoints)
# Remember to handle app state (like loaded models) if necessary for those tests,
# potentially using fixtures or mocking app.state.
