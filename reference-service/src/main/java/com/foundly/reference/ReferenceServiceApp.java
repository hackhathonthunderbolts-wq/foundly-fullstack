package com.foundly.reference;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Foundly Reference Service
 * -------------------------
 * Owns the shared lookup tables (categories, campus locations) that both the
 * Lost and Found post forms draw from (spec sections 5/6/9 — a single source
 * of truth so the two forms never drift apart), plus a lightweight
 * report/moderation intake endpoint (spec section 8.4).
 *
 * Deliberately dependency-free (uses only com.sun.net.httpserver from the
 * JDK) so it builds and runs with nothing but a JDK — no Maven/Gradle
 * download required.
 *
 * Build & run:
 *   javac -d out src/main/java/com/foundly/reference/ReferenceServiceApp.java
 *   java -cp out com.foundly.reference.ReferenceServiceApp
 *
 * Listens on port 8002 by default (override with PORT env var).
 */
public class ReferenceServiceApp {

    private static final List<String> CATEGORIES = Arrays.asList(
            "Electronics", "ID/Cards", "Bag/Backpack", "Clothing", "Books/Stationery",
            "Accessories/Jewelry", "Keys", "Wallet/Purse", "Sports Equipment", "Other"
    );

    // label -> zone, mirrors the `locations` table in the data model spec (§9.5)
    private static final Map<String, String> LOCATIONS = Map.ofEntries(
            Map.entry("Men's Hostel Block A", "hostel"),
            Map.entry("Ladies Hostel Block C", "hostel"),
            Map.entry("Academic Block 1", "academic"),
            Map.entry("Academic Block 2", "academic"),
            Map.entry("Central Library", "academic"),
            Map.entry("Food Court", "campus_life"),
            Map.entry("Sports Complex", "campus_life"),
            Map.entry("Main Gate", "campus_life"),
            Map.entry("Parking Lot", "campus_life"),
            Map.entry("Auditorium", "campus_life")
    );

    // In-memory report store (swap for the `reports` table in production — §9.9)
    private static final List<String> REPORTS = new CopyOnWriteArrayList<>();

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8002"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/health", exchange -> respondJson(exchange, 200,
                "{\"status\":\"ok\",\"service\":\"reference-service\"}"));

        server.createContext("/categories", ReferenceServiceApp::handleCategories);
        server.createContext("/locations", ReferenceServiceApp::handleLocations);
        server.createContext("/reports", ReferenceServiceApp::handleReports);

        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        System.out.println("Foundly reference-service listening on http://localhost:" + port);
    }

    private static void handleCategories(HttpExchange exchange) throws IOException {
        withCors(exchange);
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            respondJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < CATEGORIES.size(); i++) {
            if (i > 0) json.append(",");
            json.append(jsonString(CATEGORIES.get(i)));
        }
        json.append("]");
        respondJson(exchange, 200, json.toString());
    }

    private static void handleLocations(HttpExchange exchange) throws IOException {
        withCors(exchange);
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            respondJson(exchange, 405, "{\"error\":\"method not allowed\"}");
            return;
        }
        StringBuilder json = new StringBuilder("[");
        boolean first = true;
        for (Map.Entry<String, String> entry : LOCATIONS.entrySet()) {
            if (!first) json.append(",");
            first = false;
            json.append("{\"label\":").append(jsonString(entry.getKey()))
                    .append(",\"zone\":").append(jsonString(entry.getValue()))
                    .append("}");
        }
        json.append("]");
        respondJson(exchange, 200, json.toString());
    }

    private static void handleReports(HttpExchange exchange) throws IOException {
        withCors(exchange);
        String method = exchange.getRequestMethod();

        if ("POST".equalsIgnoreCase(method)) {
            String body = readBody(exchange);
            String reason = extractJsonField(body, "reason");
            String threadId = extractJsonField(body, "threadId");
            String reporterId = extractJsonField(body, "reporterId");

            if (reason == null || reason.isBlank()) {
                respondJson(exchange, 400, "{\"error\":\"reason is required\"}");
                return;
            }

            String record = String.format(
                    "{\"threadId\":%s,\"reporterId\":%s,\"reason\":%s,\"receivedAt\":%s}",
                    jsonString(threadId), jsonString(reporterId), jsonString(reason),
                    jsonString(Instant.now().toString())
            );
            REPORTS.add(record);
            respondJson(exchange, 201, record);
            return;
        }

        if ("GET".equalsIgnoreCase(method)) {
            // Admin/moderation listing — would be behind an admin auth check in production
            StringBuilder json = new StringBuilder("[");
            for (int i = 0; i < REPORTS.size(); i++) {
                if (i > 0) json.append(",");
                json.append(REPORTS.get(i));
            }
            json.append("]");
            respondJson(exchange, 200, json.toString());
            return;
        }

        respondJson(exchange, 405, "{\"error\":\"method not allowed\"}");
    }

    // -----------------------------------------------------------------
    // Tiny helpers — no JSON library dependency, kept intentionally small
    // -----------------------------------------------------------------

    private static void withCors(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type,Authorization");
    }

    private static void respondJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[1024];
            int n;
            while ((n = is.read(data)) != -1) buffer.write(data, 0, n);
            return buffer.toString(StandardCharsets.UTF_8);
        }
    }

    /** Minimal string-field extractor for flat, single-level JSON request bodies. */
    private static String extractJsonField(String json, String field) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : null;
    }

    private static String jsonString(String value) {
        if (value == null) return "null";
        String escaped = value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n");
        return "\"" + escaped + "\"";
    }
}
