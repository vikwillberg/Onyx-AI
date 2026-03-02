import requests

url = "http://127.0.0.1:8000/auth/register"
data = {"email": "test@test.com", "password": "password", "full_name": "Test User"}
resp = requests.post(url, json=data)
print(resp.json())

url = "http://127.0.0.1:8000/auth/login"
data = {"username": "test@test.com", "password": "password"}
resp = requests.post(url, data=data)
token = resp.json().get("access_token")
print("Token:", token)

url = "http://127.0.0.1:8000/projects/"
headers = {"Authorization": f"Bearer {token}"}
resp = requests.post(url, json={"name": "test project"}, headers=headers)
print("Project:", resp.json())
project_id = resp.json().get("id")

url = f"http://127.0.0.1:8000/datasets/{project_id}/create"
resp = requests.post(url, json={"name": "test dataset"}, headers=headers)
print("Dataset:", resp.json())
dataset_id = resp.json().get("id")

url = f"http://127.0.0.1:8000/datasets/{dataset_id}/upload"
files = {'files': open('test.csv', 'rb')}
resp = requests.post(url, headers=headers, files=files)
print("Upload status:", resp.status_code)
print("Upload response:", resp.text)
