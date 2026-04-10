.PHONY: dev frontend backend

FRONTEND_DIR := frontend
BACKEND_DIR := backend

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) frontend & \
	$(MAKE) backend & \
	wait

frontend:
	cd $(FRONTEND_DIR) && npm run dev

backend:
	cd $(BACKEND_DIR) && npm run dev
