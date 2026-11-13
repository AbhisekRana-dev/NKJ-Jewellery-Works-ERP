package com.nkj.billing.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Resolves the same physical image directory for both file writes and HTTP
 * static-resource reads. A relative uploads/designs path can otherwise point
 * at different folders when Spring Boot is launched from different working
 * directories (IDE, Maven, or packaged app).
 */
public final class DesignImageStoragePath {
    private DesignImageStoragePath() {}

    public static Path resolve(String configuredDirectory) {
        String configured = configuredDirectory == null || configuredDirectory.isBlank()
                ? "uploads/designs" : configuredDirectory.trim();
        Path configuredPath = Path.of(configured).normalize();
        if (configuredPath.isAbsolute()) {
            return configuredPath.toAbsolutePath().normalize();
        }

        Path workingDirectory = Path.of("").toAbsolutePath().normalize();
        Set<Path> candidates = new LinkedHashSet<>();
        Path anchor = workingDirectory;
        for (int depth = 0; anchor != null && depth < 5; depth++, anchor = anchor.getParent()) {
            candidates.add(anchor.resolve(configuredPath).normalize());
        }

        Path preferred = workingDirectory.resolve(configuredPath).normalize();
        Path bestPopulated = null;
        long bestFileCount = 0;
        for (Path candidate : candidates) {
            long fileCount = countStoredFiles(candidate);
            if (fileCount > bestFileCount) {
                bestFileCount = fileCount;
                bestPopulated = candidate;
            }
        }

        // Reuse the already-populated legacy directory when the app was
        // launched from a different working directory; otherwise use the
        // conventional directory relative to the current working directory.
        return (bestPopulated != null ? bestPopulated : preferred).toAbsolutePath().normalize();
    }

    private static long countStoredFiles(Path root) {
        if (!Files.isDirectory(root)) return 0;
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths.filter(Files::isRegularFile).limit(100_001).count();
        } catch (IOException | SecurityException ignored) {
            return 0;
        }
    }
}
