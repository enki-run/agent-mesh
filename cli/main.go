package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultURL = "https://mesh.enki.run/mcp"

func main() {
	args := os.Args[1:]
	if len(args) == 0 || args[0] == "--help" || args[0] == "-h" {
		printUsage()
		os.Exit(0)
	}

	// Parse global flags
	url := env("MESH_URL", defaultURL)
	token := env("MESH_TOKEN", "")
	var remaining []string

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--url":
			if i+1 < len(args) {
				url = args[i+1]
				i++
			}
		case "--token":
			if i+1 < len(args) {
				token = args[i+1]
				i++
			}
		default:
			remaining = append(remaining, args[i])
		}
	}

	if token == "" {
		fatal("MESH_TOKEN nicht gesetzt. Setze via: export MESH_TOKEN=bt_...")
	}

	if len(remaining) == 0 {
		printUsage()
		os.Exit(0)
	}

	cmd := remaining[0]
	cmdArgs := remaining[1:]

	switch cmd {
	case "status", "s":
		cmdStatus(url, token)
	case "send":
		cmdSend(url, token, cmdArgs)
	case "receive", "recv", "r":
		cmdReceive(url, token, cmdArgs)
	case "reply":
		cmdReply(url, token, cmdArgs)
	case "history", "hist", "h":
		cmdHistory(url, token, cmdArgs)
	case "register", "reg":
		cmdRegister(url, token, cmdArgs)
	default:
		fatal("Unbekannter Befehl: %s", cmd)
	}
}

// ── Commands ────────────────────────────────────────────────────

func cmdStatus(url, token string) {
	result := mcpCall(url, token, "mesh_status", map[string]any{})
	agents, _ := result["agents"].([]any)

	fmt.Printf("%-18s %-15s %-8s %s\n", "AGENT", "ROLE", "STATUS", "WORKING ON")
	fmt.Println(strings.Repeat("─", 70))

	for _, a := range agents {
		ag := a.(map[string]any)
		name := str(ag["name"])
		role := str(ag["role"])
		if role == "" {
			role = "—"
		}
		online, _ := ag["online"].(bool)
		status := color("\033[31m", "offline")
		if online {
			status = color("\033[32m", "ONLINE")
		}
		workingOn := str(ag["working_on"])
		if workingOn == "" {
			workingOn = "—"
		}
		if len(workingOn) > 40 {
			workingOn = workingOn[:37] + "..."
		}
		fmt.Printf("%-18s %-15s %-8s %s\n", name, role, status, workingOn)
	}
}

func cmdSend(url, token string, args []string) {
	if len(args) < 3 {
		fatal("Usage: mesh-cli send <to> <type> <payload> [--context <ctx>]")
	}

	to := args[0]
	msgType := args[1]
	payload := args[2]
	context := "mesh-cli"

	// Check for stdin pipe
	if payload == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			fatal("Stdin lesen fehlgeschlagen: %v", err)
		}
		payload = string(data)
	}

	// Parse optional flags
	for i := 3; i < len(args); i++ {
		if args[i] == "--context" && i+1 < len(args) {
			context = args[i+1]
			i++
		}
	}

	params := map[string]any{
		"to":      to,
		"type":    msgType,
		"payload": payload,
		"context": context,
	}

	result := mcpCall(url, token, "mesh_send", params)
	fmt.Printf("Sent %s to %s [%s]\n", str(result["id"]), to, msgType)
}

func cmdReceive(url, token string, args []string) {
	params := map[string]any{}

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--limit":
			if i+1 < len(args) {
				n, _ := strconv.Atoi(args[i+1])
				params["limit"] = n
				i++
			}
		case "--type":
			if i+1 < len(args) {
				params["type"] = args[i+1]
				i++
			}
		}
	}

	result := mcpCall(url, token, "mesh_receive", params)
	messages, _ := result["messages"].([]any)

	if len(messages) == 0 {
		fmt.Println("Keine neuen Nachrichten.")
		return
	}

	fmt.Printf("%-15s %-15s %-8s %s\n", "FROM", "TYPE", "TIME", "PAYLOAD")
	fmt.Println(strings.Repeat("─", 70))

	for _, m := range messages {
		msg := m.(map[string]any)
		from := str(msg["from"])
		msgType := str(msg["type"])
		created := str(msg["created_at"])
		payload := str(msg["payload"])

		t, err := time.Parse(time.RFC3339Nano, created)
		timeStr := created
		if err == nil {
			timeStr = t.Local().Format("15:04")
		}

		if len(payload) > 60 {
			payload = payload[:57] + "..."
		}
		payload = strings.ReplaceAll(payload, "\n", " ")

		fmt.Printf("%-15s %-15s %-8s %s\n", from, msgType, timeStr, payload)
	}

	fmt.Printf("\n%d Nachricht(en)\n", len(messages))
}

func cmdReply(url, token string, args []string) {
	if len(args) < 2 {
		fatal("Usage: mesh-cli reply <message_id> <payload>")
	}

	msgID := args[0]
	payload := args[1]

	if payload == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			fatal("Stdin lesen fehlgeschlagen: %v", err)
		}
		payload = string(data)
	}

	params := map[string]any{
		"message_id": msgID,
		"payload":    payload,
		"context":    "mesh-cli",
	}

	result := mcpCall(url, token, "mesh_reply", params)
	fmt.Printf("Reply gesendet: %s\n", str(result["id"]))
}

func cmdHistory(url, token string, args []string) {
	if len(args) < 1 {
		fatal("Usage: mesh-cli history <correlation_id>")
	}

	params := map[string]any{
		"correlation_id": args[0],
	}

	result := mcpCall(url, token, "mesh_history", params)
	messages, _ := result["messages"].([]any)

	if len(messages) == 0 {
		fmt.Println("Keine Nachrichten in diesem Thread.")
		return
	}

	fmt.Printf("Thread: %s\n\n", args[0])

	for _, m := range messages {
		msg := m.(map[string]any)
		from := str(msg["from"])
		to := str(msg["to"])
		msgType := str(msg["type"])
		payload := str(msg["payload"])
		created := str(msg["created_at"])

		t, err := time.Parse(time.RFC3339Nano, created)
		timeStr := created
		if err == nil {
			timeStr = t.Local().Format("15:04:05")
		}

		fmt.Printf("  [%s] %s → %s [%s]\n", timeStr, from, to, msgType)
		// Indent payload lines
		for _, line := range strings.Split(payload, "\n") {
			if line != "" {
				fmt.Printf("    %s\n", line)
			}
		}
		fmt.Println()
	}
}

func cmdRegister(url, token string, args []string) {
	if len(args) < 1 {
		fatal("Usage: mesh-cli register <role> [--capabilities <a,b>] [--working-on <text>]")
	}

	params := map[string]any{
		"role": args[0],
	}

	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--capabilities":
			if i+1 < len(args) {
				caps := strings.Split(args[i+1], ",")
				params["capabilities"] = caps
				i++
			}
		case "--working-on":
			if i+1 < len(args) {
				params["working_on"] = args[i+1]
				i++
			}
		}
	}

	mcpCall(url, token, "mesh_register", params)
	fmt.Printf("Registriert als %s\n", args[0])
}

// ── MCP Client ──────────────────────────────────────────────────

func mcpCall(url, token, tool string, args map[string]any) map[string]any {
	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      tool,
			"arguments": args,
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		fatal("JSON encode: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		fatal("Request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fatal("Verbindung fehlgeschlagen: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fatal("Response lesen: %v", err)
	}

	if resp.StatusCode == 401 {
		fatal("Nicht autorisiert. Token pruefen.")
	}

	if resp.StatusCode != 200 {
		fatal("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var rpcResp map[string]any
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		fatal("Response parse: %v", err)
	}

	if rpcErr, ok := rpcResp["error"].(map[string]any); ok {
		fatal("Fehler: %s", str(rpcErr["message"]))
	}

	// Extract text content from MCP response
	result, _ := rpcResp["result"].(map[string]any)
	content, _ := result["content"].([]any)
	if len(content) == 0 {
		fatal("Leere Antwort vom Server")
	}

	first := content[0].(map[string]any)
	text := str(first["text"])

	// Check if it's an error response from the tool
	if isErr, ok := result["isError"].(bool); ok && isErr {
		fatal("%s", text)
	}

	var parsed map[string]any
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		fatal("Tool response parse: %v\n%s", err, text)
	}

	return parsed
}

// ── Helpers ─────────────────────────────────────────────────────

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

func color(code, text string) string {
	if !isTTY() {
		return text
	}
	return code + text + "\033[0m"
}

func isTTY() bool {
	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return fi.Mode()&os.ModeCharDevice != 0
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "mesh-cli: "+format+"\n", args...)
	os.Exit(1)
}

func printUsage() {
	fmt.Print(`mesh-cli — Agent Mesh CLI

Usage:
  mesh-cli status                              Agents und Online-Status
  mesh-cli send <to> <type> <payload>          Nachricht senden
  mesh-cli send <to> <type> -                  Payload von stdin lesen
  mesh-cli receive [--limit N] [--type T]      Inbox pruefen
  mesh-cli reply <msg_id> <payload>            Auf Nachricht antworten
  mesh-cli history <correlation_id>            Thread anzeigen
  mesh-cli register <role> [--capabilities X]  Registrieren

Aliases: s=status, r=receive/recv, h=history/hist, reg=register

Umgebungsvariablen:
  MESH_TOKEN    Bearer Token (Pflicht)
  MESH_URL      MCP Endpoint (default: https://mesh.enki.run/mcp)

Piping:
  echo "logs" | mesh-cli send ops incident -
  docker logs app | mesh-cli send ops incident -
  ssh server "journalctl -u app" | mesh-cli send ops incident -

Flags:
  --token <t>          Token (statt MESH_TOKEN)
  --url <u>            URL (statt MESH_URL)
  --context <c>        Context fuer send (default: mesh-cli)
  --limit <n>          Max Messages fuer receive
  --type <t>           Type-Filter fuer receive
  --capabilities <a,b> Komma-getrennt fuer register
  --working-on <text>  Aktuelle Aufgabe fuer register
`)
}
