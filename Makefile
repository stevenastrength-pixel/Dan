.PHONY: help install dev build start test test-watch db-push db-seed db-setup db-studio docker-up docker-down clean

help:
	@echo "Available targets:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Start the Next.js dev server"
	@echo "  make build        Build the production app"
	@echo "  make start        Start the production server"
	@echo "  make test         Run the test suite"
	@echo "  make test-watch   Run tests in watch mode"
	@echo "  make db-push      Push the Prisma schema"
	@echo "  make db-seed      Run the Prisma seed script"
	@echo "  make db-setup     Push schema and seed the database"
	@echo "  make db-studio    Open Prisma Studio"
	@echo "  make docker-up    Build and start the Docker Compose stack"
	@echo "  make docker-down  Stop the Docker Compose stack"
	@echo "  make clean        Remove node_modules and Next build output"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

test:
	npm test

test-watch:
	npm run test:watch

db-push:
	npm run db:push

db-seed:
	npm run db:seed

db-setup:
	npm run db:setup

db-studio:
	npm run db:studio

docker-up:
	docker compose up --build

docker-down:
	docker compose down

clean:
	rm -rf node_modules .next
