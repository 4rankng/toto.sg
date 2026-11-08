# toto.sg — self-host deploy to https://toto.tingting.vip
#
#   make dev      run the Vite dev server locally (http://localhost:5173)
#   make deploy   regenerate nulls -> league -> export graph -> verify data -> build -> push image -> ship -> live check
#   make ship     just pull + restart the container on the server (image already pushed)
#   make caddy    ensure the toto.tingting.vip vhost exists and reload Caddy
#   make check    live-endpoint smoke test (league contract + /api/latest)
#   make nulls    recompute the EXACT combinatorial null tables offline and
#                 rewrite the generated block in src/lib/insights-sequence-dynamics.ts
#   make verify-nulls
#                 re-derive the sequence analytics' nulls from the archive and
#                 fail when one of them drifts
#
# `verify` gates the whole pipeline: a corrupted strategies.json (null scores,
# duplicate placeholder rows) fails npm run verify:data and aborts the deploy
# BEFORE it can reach the registry or the server.
#
# The null tables are computed OFFLINE on purpose: the exact null over all
# C(49,6) = 13,983,816 lines is a multi-million-term enumeration that no
# browser should pay for. `make nulls` runs it once and embeds the result;
# `make deploy` runs it first so the embedded tables can never drift from the
# code that generates them.
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

.PHONY: dev deploy league graph verify verify-nulls nulls build login image ship caddy check

dev:
	npm run dev

deploy: nulls verify-nulls league graph verify build image ship check

nulls:
	npm run nulls

verify-nulls:
	npm run verify:nulls

league:
	npm run league

graph:
	npm run graph

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

# The league contract: the live league must carry exactly the rows of the
# committed artifact, every score finite. The expected count comes from the
# artifact itself, so it never drifts from the league the UI was built against.
check:
	@curl -fsS https://$(VHOST)/api/latest >/dev/null && echo "OK /api/latest"
	@EXPECTED=$$(node -e "console.log(require('./public/data/strategies.json').strategies.length)"); \
	 curl -fsS https://$(VHOST)/data/strategies.json | EXPECTED=$$EXPECTED node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const bad=j.strategies.some(r=>r.score==null);const expected=Number(process.env.EXPECTED);if(j.strategies.length!==expected||bad){console.error('FAIL league: '+j.strategies.length+' strategies, expected '+expected+(bad?', null scores':''));process.exit(1)}console.log('OK league: '+j.strategies.length+' strategies, no null scores')})"
	@curl -fsS -o /dev/null https://$(VHOST)/strategies && echo "OK /strategies"
	@curl -fsS -o /dev/null https://$(VHOST)/data/graph.json && echo "OK graph"
