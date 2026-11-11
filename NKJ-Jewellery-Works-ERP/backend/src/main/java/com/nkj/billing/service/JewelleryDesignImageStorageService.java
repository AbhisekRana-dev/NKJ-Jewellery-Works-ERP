package com.nkj.billing.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriter;
import javax.imageio.ImageWriteParam;
import javax.imageio.IIOImage;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.List;
import java.util.Iterator;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class JewelleryDesignImageStorageService {
    private static final long MAX_IMAGE_BYTES = 10L * 1024L * 1024L;
    private static final int DISPLAY_MAX_EDGE = 2400;
    private static final int THUMBNAIL_MAX_EDGE = 640;

    private final Path uploadRoot;

    public JewelleryDesignImageStorageService(
            @Value("${nkj.designs.upload-dir:uploads/designs}") String uploadDirectory) {
        this.uploadRoot = Path.of(uploadDirectory).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadRoot);
            if (!Files.isDirectory(this.uploadRoot) || !Files.isWritable(this.uploadRoot)) {
                throw new IllegalStateException("The jewellery image storage directory is not writable: " + this.uploadRoot);
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not initialize the persistent jewellery image storage directory: " + this.uploadRoot, error);
        }
    }

    public StoredImage store(long designId, MultipartFile file) throws IOException {
        return store(designId, file, 0, 1.0d);
    }

    public StoredImage store(long designId, MultipartFile file, int rotationDegrees, double cropZoom) throws IOException {
        int rotation = ((rotationDegrees % 360) + 360) % 360;
        if (rotation != 0 && rotation != 90 && rotation != 180 && rotation != 270) {
            throw new IllegalArgumentException("Image rotation must be 0, 90, 180 or 270 degrees.");
        }
        if (!Double.isFinite(cropZoom) || cropZoom < 1.0d || cropZoom > 2.0d) {
            throw new IllegalArgumentException("Image crop zoom must be between 1.0× and 2.0×.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a non-empty image file.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("Each jewellery image must be 10 MB or smaller.");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        byte[] bytes = file.getBytes();
        BufferedImage source;
        String extension;
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes);
             ImageInputStream imageInput = ImageIO.createImageInputStream(input)) {
            if (imageInput == null) {
                throw new IllegalArgumentException("The selected file is not a supported image.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("The selected file is not a valid JPG, PNG or WebP image.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                String imageFormat = reader.getFormatName().toLowerCase(Locale.ROOT);
                String expectedMime;
                extension = switch (imageFormat) {
                    case "jpg", "jpeg" -> { expectedMime = "image/jpeg"; yield ".jpg"; }
                    case "png" -> { expectedMime = "image/png"; yield ".png"; }
                    case "webp" -> { expectedMime = "image/webp"; yield ".webp"; }
                    default -> throw new IllegalArgumentException("Only JPG, JPEG, PNG and WebP image files are supported.");
                };
                if (!contentType.isBlank()
                        && !"application/octet-stream".equals(contentType)
                        && !expectedMime.equals(contentType)
                        && !("image/jpg".equals(contentType) && "image/jpeg".equals(expectedMime))) {
                    throw new IllegalArgumentException("The uploaded image content does not match its reported file type.");
                }
                String originalName = file.getOriginalFilename();
                if (originalName != null && originalName.lastIndexOf('.') >= 0) {
                    String suppliedExtension = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
                    String normalizedExtension = "jpeg".equals(suppliedExtension) ? "jpg" : suppliedExtension;
                    if (List.of("jpg", "png", "webp").contains(normalizedExtension)
                            && !extension.substring(1).equals(normalizedExtension)) {
                        throw new IllegalArgumentException("The selected file extension does not match its image content.");
                    }
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 8000 || height > 8000 || (long) width * height > 24000000L) {
                    throw new IllegalArgumentException("Image dimensions must not exceed 8000 × 8000 pixels or 24 megapixels.");
                }
                source = reader.read(0);
            } finally {
                reader.dispose();
            }
        }
        if (source == null) {
            throw new IllegalArgumentException("The selected file is not a valid JPG, PNG or WebP image.");
        }

        String fileId = UUID.randomUUID().toString();
        Path designDirectory = uploadRoot.resolve(Long.toString(designId)).normalize();
        if (!designDirectory.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("Invalid design image destination.");
        }
        Files.createDirectories(designDirectory);

        Path originalPath = designDirectory.resolve(fileId + extension);
        Path displayPath = designDirectory.resolve(fileId + "-display.jpg");
        Path thumbnailPath = designDirectory.resolve(fileId + "-thumb.jpg");
        try {
            // Keep the uploaded bytes untouched as the archival original.
            Files.write(originalPath, bytes);

            // A separate high-quality display derivative is capped at 2400px;
            // the 640px thumbnail is used only for dense catalogue cards.
            BufferedImage display = createScaledJpeg(source, DISPLAY_MAX_EDGE, rotation, cropZoom);
            writeHighQualityJpeg(display, displayPath);
            BufferedImage thumbnail = createScaledJpeg(source, THUMBNAIL_MAX_EDGE, rotation, cropZoom);
            writeHighQualityJpeg(thumbnail, thumbnailPath);
        } catch (IOException error) {
            Files.deleteIfExists(originalPath);
            Files.deleteIfExists(displayPath);
            Files.deleteIfExists(thumbnailPath);
            throw error;
        }

        return new StoredImage(
                "/api/uploads/designs/" + designId + "/" + fileId + extension,
                "/api/uploads/designs/" + designId + "/" + fileId + "-display.jpg",
                "/api/uploads/designs/" + designId + "/" + fileId + "-thumb.jpg",
                file.getOriginalFilename() == null ? "Jewellery design" : file.getOriginalFilename(),
                sha256(bytes)
        );
    }

    public void deleteStoredPath(String publicUrl) {
        if (publicUrl == null || !publicUrl.startsWith("/api/uploads/designs/")) {
            return;
        }
        String relative = publicUrl.substring("/api/uploads/designs/".length());
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

    private void writeHighQualityJpeg(BufferedImage image, Path path) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) throw new IOException("JPEG image encoding is not available.");
        ImageWriter writer = writers.next();
        try (ImageOutputStream output = ImageIO.createImageOutputStream(path.toFile())) {
            if (output == null) throw new IOException("Could not create the image output stream.");
            writer.setOutput(output);
            ImageWriteParam parameters = writer.getDefaultWriteParam();
            if (parameters.canWriteCompressed()) {
                parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                parameters.setCompressionQuality(0.94f);
            }
            writer.write(null, new IIOImage(image, null, null), parameters);
        } finally {
            writer.dispose();
        }
    }

    private BufferedImage createScaledJpeg(
            BufferedImage source,
            int maxEdge,
            int rotationDegrees,
            double cropZoom) {
        boolean quarterTurn = rotationDegrees == 90 || rotationDegrees == 270;
        int rotatedWidth = quarterTurn ? source.getHeight() : source.getWidth();
        int rotatedHeight = quarterTurn ? source.getWidth() : source.getHeight();
        double scale = Math.min(1.0, (double) maxEdge / Math.max(rotatedWidth, rotatedHeight));
        int width = Math.max(1, (int) Math.round(rotatedWidth * scale));
        int height = Math.max(1, (int) Math.round(rotatedHeight * scale));

        BufferedImage output = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = output.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setColor(java.awt.Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.translate(width / 2.0d, height / 2.0d);
            graphics.rotate(Math.toRadians(rotationDegrees));
            graphics.scale(scale * cropZoom, scale * cropZoom);
            graphics.drawImage(source, -source.getWidth() / 2, -source.getHeight() / 2, null);
        } finally {
            graphics.dispose();
        }
        return output;
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is not available in this Java runtime.", error);
        }
    }

    public record StoredImage(String originalUrl, String displayUrl, String thumbnailUrl, String fileName, String sha256) {}
}
