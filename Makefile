.PHONY: start stop restart logs clean clean-volumes

start:
	./scripts/start.sh

stop:
	docker compose down

restart:
	$(MAKE) stop
	$(MAKE) start

logs:
	docker compose logs -f --tail=200

clean:
	docker compose down --remove-orphans

clean-volumes:
	@printf 'This deletes Steply containers and PostgreSQL volume data. Type yes to continue: '; \
	read -r answer; \
	if [ "$$answer" != "yes" ]; then \
		printf 'Cancelled.\n'; \
		exit 1; \
	fi
	docker compose down -v --remove-orphans
