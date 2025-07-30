run:
	server/env/bin/fastapi run server/api/main.py --reload --port 8011 & \
	server/env/bin/python -m http.server --directory client