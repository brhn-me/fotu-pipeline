.PHONY: up down build logs restart db-migrate db-revision frontend-install backend-install clean help

# Docker commands
up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

restart:
	docker-compose restart

# Database migrations
db-migrate:
	docker-compose exec api alembic upgrade head

db-revision:
	@read -p "Enter revision message: " msg; \
	docker-compose exec api alembic revision --autogenerate -m "$$msg"

# Dependency management
frontend-install:
	cd frontend && npm install

backend-install:
	cd backend && pip install -r requirements.txt

# Cleanup
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf frontend/dist
	docker-compose down -v

# Help
help:
	@echo "Available targets:"
	@echo "  up                - Start all services"
	@echo "  down              - Stop all services"
	@echo "  build             - Build/rebuild services"
	@echo "  logs              - Tail logs for all services"
	@echo "  restart           - Restart all services"
	@echo "  db-migrate        - Run database migrations"
	@echo "  db-revision       - Create a new Alembic revision (requires input)"
	@echo "  frontend-install  - Install frontend dependencies"
	@echo "  backend-install   - Install backend dependencies"
	@echo "  clean             - Cleanup pycache, build artifacts, and docker volumes"
