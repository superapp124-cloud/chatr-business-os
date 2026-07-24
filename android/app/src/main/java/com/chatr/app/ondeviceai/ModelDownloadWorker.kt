package com.chatr.app.ondeviceai

import android.content.Context
import android.os.StatFs
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest

class ModelDownloadWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val MODEL_URL = "https://cdn.chatr.chat/models/gemma3-1b-it-int4-v1.task"
        const val EXPECTED_SHA256 = "EXPECTED_SHA256_HASH_HERE" // Replace with actual hash
        private const val REQUIRED_DISK_SPACE_BYTES = 600L * 1024 * 1024 // 600MB
        private const val TAG = "ModelDownloadWorker"

        internal fun validateChecksum(file: File, expectedHash: String): Boolean {
            // If placeholder, skip check for dev purposes. In prod, must match.
            if (expectedHash == "EXPECTED_SHA256_HASH_HERE") {
                Log.w(TAG, "CRITICAL WARNING: Checksum validation skipped due to placeholder hash. Do NOT ship this to production.")
                return true
            }
            
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use {
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (it.read(buffer).also { read -> bytesRead = read } != -1) {
                    digest.update(buffer, 0, bytesRead)
                }
            }
            val hashBytes = digest.digest()
            val actualHash = hashBytes.joinToString("") { "%02x".format(it) }
            return actualHash.equals(expectedHash, ignoreCase = true)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val llmDir = File(context.filesDir, "llm")
        if (!llmDir.exists()) llmDir.mkdirs()

        val finalFile = File(llmDir, "gemma3-1b-it-int4-v1.task")
        val tmpFile = File(llmDir, "gemma3-1b-it-int4-v1.tmp")

        // If it's already fully downloaded and valid, success.
        if (finalFile.exists()) {
            return@withContext Result.success()
        }

        // Storage Check
        val statFs = StatFs(llmDir.path)
        val availableBytes = statFs.availableBlocksLong * statFs.blockSizeLong
        if (availableBytes < REQUIRED_DISK_SPACE_BYTES) {
            Log.e(TAG, "Insufficient disk space. Required: 600MB, Available: \${availableBytes / (1024 * 1024)}MB")
            return@withContext Result.failure() // Hard fail due to missing space
        }

        val downloadedBytes = if (tmpFile.exists()) tmpFile.length() else 0L

        val client = OkHttpClient()
        val requestBuilder = Request.Builder().url(MODEL_URL)

        if (downloadedBytes > 0) {
            requestBuilder.addHeader("Range", "bytes=\$downloadedBytes-")
        }

        try {
            val response = client.newCall(requestBuilder.build()).execute()
            
            if (!response.isSuccessful) {
                if (response.code == 416) {
                    // Range not satisfiable, file might have changed on server
                    tmpFile.delete()
                    return@withContext Result.retry()
                }
                Log.e(TAG, "Server returned \${response.code}")
                return@withContext Result.retry()
            }

            val isPartial = response.code == 206
            val append = isPartial && downloadedBytes > 0

            val body = response.body ?: return@withContext Result.retry()
            
            saveToFile(body.byteStream(), tmpFile, append)

            // Validate checksum
            val checksumValid = validateChecksum(tmpFile, EXPECTED_SHA256)
            if (checksumValid) {
                // Atomic rename
                if (tmpFile.renameTo(finalFile)) {
                    Log.i(TAG, "Model downloaded and verified successfully.")
                    return@withContext Result.success()
                } else {
                    Log.w(TAG, "Failed to rename temp file. Attempting copy+delete fallback.")
                    return@withContext try {
                        tmpFile.copyTo(finalFile, overwrite = true)
                        tmpFile.delete()
                        Log.i(TAG, "Model fallback copy+delete succeeded.")
                        Result.success()
                    } catch (e: Exception) {
                        Log.e(TAG, "Fallback copy+delete failed. Deleting temp file to break loop.", e)
                        tmpFile.delete()
                        Result.failure()
                    }
                }
            } else {
                Log.e(TAG, "Checksum validation failed. Deleting corrupted temp file.")
                tmpFile.delete() // Corrupt, start from zero next time
                return@withContext Result.retry()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Download failed with exception", e)
            return@withContext Result.retry()
        }
    }

    private fun saveToFile(inputStream: InputStream, file: File, append: Boolean) {
        val outputStream = FileOutputStream(file, append)
        inputStream.use { input ->
            outputStream.use { output ->
                input.copyTo(output)
            }
        }
    }


}
