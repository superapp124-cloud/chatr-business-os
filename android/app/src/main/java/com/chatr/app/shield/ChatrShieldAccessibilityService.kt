package com.chatr.app.shield

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class ChatrShieldAccessibilityService : AccessibilityService() {
    companion object {
        private const val TAG = "ChatrShieldAccess"
        private const val PREFS_NAME = "chatr_accessibility_context"
        private const val KEY_LAST_PACKAGE = "last_package"
        private const val KEY_LAST_TEXT = "last_text"
        private const val KEY_LAST_CAPTURED_AT = "last_captured_at"
        private const val MAX_CONTEXT_CHARS = 2_000

        @Volatile
        var isActive: Boolean = false
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isActive = true
        Log.i(TAG, "Accessibility context service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        ) {
            return
        }

        val root = rootInActiveWindow ?: return
        try {
            val text = extractText(root)
                .replace(Regex("\\s+"), " ")
                .trim()
                .take(MAX_CONTEXT_CHARS)
            if (text.isBlank()) return

            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(KEY_LAST_PACKAGE, event.packageName?.toString().orEmpty())
                .putString(KEY_LAST_TEXT, text)
                .putLong(KEY_LAST_CAPTURED_AT, System.currentTimeMillis())
                .apply()
        } finally {
            root.recycle()
        }
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        isActive = false
        super.onDestroy()
    }

    private fun extractText(node: AccessibilityNodeInfo): String {
        val builder = StringBuilder()
        node.text?.let { builder.append(it).append(' ') }
        node.contentDescription?.let { builder.append(it).append(' ') }

        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            try {
                builder.append(extractText(child))
            } finally {
                child.recycle()
            }
        }
        return builder.toString()
    }
}
