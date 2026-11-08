#!/usr/bin/env python3
"""toto-graph loader — builds a NetworkX graph from public/data/graph.json.

Usage: python3 scripts/graph_to_networkx.py public/data/graph.json

Without networkx installed, prints the same summary from the raw JSON.
"""
import json
import sys


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def summarize(node_count, rel_counts, hub_count, top_hubs, extra=""):
    print(f"nodes: {node_count}")
    for rel, count in rel_counts:
        print(f"edges {rel}: {count}")
    print(f"hyperedges triplets: {hub_count}")
    print("top-5 hub balls by hub_centrality:")
    for ball, score in top_hubs:
        print(f"  ball {ball}: {score}")
    if extra:
        print(extra)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    graph = load(sys.argv[1])
    nodes = graph["nodes"]
    edges = graph["edges"]

    rel_counts = []
    for rel in ("markov_lag1", "cooccurrence", "grid_topology"):
        rel_counts.append((rel, len(edges[rel])))
    triplets = graph["hyperedges"]["triplets"]
    top_hubs = sorted(
        ((n["id"], n["hub_centrality"]) for n in nodes),
        key=lambda item: item[1],
        reverse=True,
    )[:5]

    try:
        import networkx as nx
    except ImportError:
        summarize(len(nodes), rel_counts, len(triplets), top_hubs,
                  extra="(networkx not installed — summary from raw JSON)")
        return 0

    g = nx.MultiDiGraph()
    for n in nodes:
        attrs = dict(n)
        attrs.update(attrs.pop("velocity"))
        attrs.update(attrs.pop("z_horizon"))
        attrs.update(attrs.pop("ema"))
        g.add_node(n["id"], **attrs)
    for edge in edges["markov_lag1"]:
        g.add_edge(edge["from"], edge["to"], rel="markov_lag1", weight=edge["lift"], count=edge["count"])
    for edge in edges["cooccurrence"]:
        g.add_edge(edge["a"], edge["b"], rel="cooccurrence", z=edge["z"], count=edge["count"])
    for edge in edges["grid_topology"]:
        g.add_edge(edge["a"], edge["b"], rel="grid_topology")
        g.add_edge(edge["b"], edge["a"], rel="grid_topology")

    draws = {tuple(h["nodes"]): h for h in graph["hyperedges"]["draws"]}
    summarize(g.number_of_nodes(), rel_counts, len(triplets), top_hubs,
              extra=f"draw hyperedges keyed by node tuple: {len(draws)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
