# toto.sg — self-host deploy to https://toto.tingting.vip
#
#   make deploy   regenerate league -> verify data -> build -> push image -> ship -> live check
#   make ship     just pull + restart the container on the server (image already pushed)
#   make caddy    ensure the toto.tingting.vip vhost exists and reload Caddy
#   make check    live-endpoint smoke test (league contract + /api/latest)
#
# `verify` gates the whole pipeline: a corrupted strategies.json (null scores,
# duplicate placeholder rows) fails npm run verify:data and aborts the deploy
# BEFORE it can reach the registry or the server.
#
# Server: bot.tingting.vip — container toto-web on 172.17.0.1:8090, fronted by
# the box Caddy (vfic-caddy-1) with auto-TLS. Image: ghcr.io/4rankng/toto.sg.

SERVER := root@bot.tingting.vip
IMAGE  := ghcr.io/4rankng/toto.sg
TAG    := main
NAME   := toto-web
PORT   := 172.17.0.1:8090:8080
VHOST  := toto.tingting.vip
CADDY  := /opt/vfic/Caddyfile

.PHONY: deploy league verify build login image ship caddy check

deploy: league verify build image ship check

league:
	npm run league:custom

verify:
	npm run verify:data

build:
	npm run build

login:
	gh auth token | docker login ghcr.io -u 4rankng --password-stdin

image: login
	docker buildx build --platform linux/amd64 --push -t $(IMAGE):$(TAG) .

ship:
	ssh $(SERVER) 'docker pull $(IMAGE):$(TAG) && { docker rm -f $(NAME) 2>/dev/null || true; } && docker run -d --name $(NAME) --restart unless-stopped -p $(PORT) $(IMAGE):$(TAG)'
	@$(MAKE) --no-print-directory caddy

caddy:
	ssh $(SERVER) 'grep -q "$(VHOST)" $(CADDY) || printf "\n# --- toto.sg edge vhost: static container $(NAME) on 172.17.0.1:8090 (image $(IMAGE)) ---\n$(VHOST) {\n\tencode zstd gzip\n\treverse_proxy 172.17.0.1:8090\n}\n" >> $(CADDY); docker exec vfic-caddy-1 caddy validate --config /etc/caddy/Caddyfile && docker exec vfic-caddy-1 caddy reload --config /etc/caddy/Caddyfile'

# The league contract: exactly 224 strategies, every score finite. Matches
# scripts/verify-data.mjs plus the count the UI copy is written against.
check:
	@curl -fsS https://$(VHOST)/api/latest >/dev/null && echo "OK /api/latest"
	@curl -fsS https://$(VHOST)/data/strategies.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const bad=j.strategies.some(r=>r.score==null);if(j.strategies.length!==224||bad){console.error('FAIL league: '+j.strategies.length+' strategies'+(bad?', null scores':''));process.exit(1)}console.log('OK league: 224 strategies, no null scores')})"
	@curl -fsS -o /dev/null https://$(VHOST)/strategies && echo "OK /strategies"
