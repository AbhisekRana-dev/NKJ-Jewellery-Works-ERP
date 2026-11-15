package com.nkj.billing.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

import org.junit.jupiter.api.Test;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;

import java.util.Map;

class JewelleryDesignControllerQrTest {

    @Test
    void decodesQrImageWithStructuredJewelleryFields() throws Exception {
        String payload = "designName=Test Necklace\nstyle=Traditional\nmaterial=Gold\nweight=1.5 g";
        BitMatrix matrix = new MultiFormatWriter().encode(
                payload,
                BarcodeFormat.QR_CODE,
                420,
                420,
                Map.of(EncodeHintType.CHARACTER_SET, "UTF-8"));
        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(matrix);

        assertEquals(payload, JewelleryDesignController.decodeQrText(qrImage));
    }

    @Test
    void decodesQrImageWhenPhotoIsRotated() throws Exception {
        String payload = "NKJ-GOLD-TEST-001";
        BitMatrix matrix = new MultiFormatWriter().encode(payload, BarcodeFormat.QR_CODE, 360, 360);
        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(matrix);
        BufferedImage rotated = new BufferedImage(qrImage.getHeight(), qrImage.getWidth(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rotated.createGraphics();
        try {
            graphics.translate(qrImage.getHeight(), 0);
            graphics.rotate(Math.PI / 2);
            graphics.drawImage(qrImage, 0, 0, null);
        } finally {
            graphics.dispose();
        }

        assertEquals(payload, JewelleryDesignController.decodeQrText(rotated));
    }

    @Test
    void returnsNoResultForAnImageWithoutQrCode() {
        BufferedImage plainImage = new BufferedImage(320, 240, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = plainImage.createGraphics();
        try {
            graphics.setColor(java.awt.Color.WHITE);
            graphics.fillRect(0, 0, plainImage.getWidth(), plainImage.getHeight());
        } finally {
            graphics.dispose();
        }

        assertNull(JewelleryDesignController.decodeQrText(plainImage));
    }
}
