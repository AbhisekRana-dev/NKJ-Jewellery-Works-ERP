package com.nkj.billing.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

@Service
public class JewelleryDesignImageStorageService {
    private static final long MAX_IMAGE_BYTES = 10L * 1024L * 1024L;
    private static final int THUMBNAIL_MAX_EDGE = 800;

    private final Path uploadRoot;

    public JewelleryDesignImageStorageService(
            @Value("${nkj.designs.upload-dir:uploads/designs}") String uploadDirectory) {
        this.uploadRoot = Path.of(uploadDirectory).toAbsolutePath().normalize();
    }

    public StoredImage store(long designId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a non-empty image file.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("Each jewellery image must be 10 MB or smaller.");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension;
        if ("image/jpeg".equals(contentType) || "image/jpg".equals(contentType)) {
            extension = ".jpg";
        } else if ("image/png".equals(contentType)) {
            extension = ".png";
        } else {
            throw new IllegalArgumentException("Only JPG, JPEG and PNG image files are supported.");
        }

        byte[] bytes = file.getBytes();
        BufferedImage source;
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            source = ImageIO.read(input);
        }
        if (source == null || source.getWidth() < 1 || source.getHeight() < 1) {
            throw new IllegalArgumentException("The selected file is not a valid JPG or PNG image.");
        }
        if (source.getWidth() > 8000 || source.getHeight() > 8000 || (long) source.getWidth() * source.getHeight() > 24000000L) {
            throw new IllegalArgumentException("Image dimensions must not exceed 8000 × 8000 pixels or 24 megapixels.");
        }

        String fileId = UUID.randomUUID().toString();
        Path designDirectory = uploadRoot.resolve(Long.toString(designId)).normalize();
        if (!designDirectory.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("Invalid design image destination.");
        }
        Files.createDirectories(designDirectory);

        Path originalPath = designDirectory.resolve(fileId + extension);
        Path thumbnailPath = designDirectory.resolve(fileId + "-thumb.jpg");
        try {
            Files.write(originalPath, bytes);
            BufferedImage thumbnail = createThumbnail(source);
            if (!ImageIO.write(thumbnail, "jpg", thumbnailPath.toFile())) {
                throw new IOException("The image thumbnail could not be generated.");
            }
        } catch (IOException error) {
            Files.deleteIfExists(originalPath);
            Files.deleteIfExists(thumbnailPath);
            throw error;
        }

        return new StoredImage(
                "/uploads/designs/" + designId + "/" + fileId + extension,
                "/uploads/designs/" + designId + "/" + fileId + "-thumb.jpg",
                file.getOriginalFilename() == null ? "Jewellery design" : file.getOriginalFilename()
        );
    }

    public void deleteStoredPath(String publicUrl) {
        if (publicUrl == null || !publicUrl.startsWith("/uploads/designs/")) {
            return;
        }
        String relative = publicUrl.substring("/uploads/designs/".length());
        Path target = uploadRoot.resolve(relative).normalize();
        if (!target.startsWith(uploadRoot)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // A failed disk cleanup must not expose a path or block catalog edits.
        }
    }

    private BufferedImage createThumbnail(BufferedImage source) {
        double scale = Math.min(1.0, (double) THUMBNAIL_MAX_EDGE /
                Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage output = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = output.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setColor(java.awt.Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return output;
    }

    public record StoredImage(String originalUrl, String thumbnailUrl, String fileName) {}
}
