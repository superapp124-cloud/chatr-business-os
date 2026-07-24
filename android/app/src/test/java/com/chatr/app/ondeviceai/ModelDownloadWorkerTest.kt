package com.chatr.app.ondeviceai

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

class ModelDownloadWorkerTest {

    @Test
    fun `validateChecksum returns true for matching hash`() {
        val tempFile = File.createTempFile("good_model", ".tmp")
        tempFile.deleteOnExit()
        
        val content = "This is a valid model file content"
        FileOutputStream(tempFile).use { it.write(content.toByteArray()) }
        
        val expectedHash = hashString(content)
        
        val result = ModelDownloadWorker.validateChecksum(tempFile, expectedHash)
        assertTrue("Checksum should be valid", result)
    }

    @Test
    fun `validateChecksum returns false for corrupted hash`() {
        val tempFile = File.createTempFile("corrupted_model", ".tmp")
        tempFile.deleteOnExit()
        
        val content = "This is corrupted model file content"
        FileOutputStream(tempFile).use { it.write(content.toByteArray()) }
        
        val expectedHash = hashString("Different expected content")
        
        val result = ModelDownloadWorker.validateChecksum(tempFile, expectedHash)
        assertFalse("Checksum should fail due to mismatch", result)
    }

    private fun hashString(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray())
        return hashBytes.joinToString("") { "%02x".format(it) }
    }
}
