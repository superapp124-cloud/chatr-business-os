package com.chatr.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

class PostCallSummaryActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_call_summary)

        val phoneNumber = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: "Unknown"
        val summaryText = intent.getStringExtra(EXTRA_SUMMARY) ?: "No summary available."
        val keyPoints = intent.getStringArrayListExtra(EXTRA_KEY_POINTS) ?: emptyList<String>()
        val actionItems = intent.getStringArrayListExtra(EXTRA_ACTION_ITEMS) ?: emptyList<String>()
        
        findViewById<TextView>(R.id.summaryText).text = summaryText
        
        val keyPointsTv = findViewById<TextView>(R.id.keyPointsText)
        if (keyPoints.isEmpty()) {
            keyPointsTv.text = ""
        } else {
            keyPointsTv.text = "Key Points:\n" + keyPoints.joinToString("\n") { "• $it" }
        }
        
        val chipsContainer = findViewById<LinearLayout>(R.id.actionChipsContainer)
        if (actionItems.isNotEmpty()) {
            for (action in actionItems) {
                val chip = LayoutInflater.from(this).inflate(R.layout.item_action_chip, chipsContainer, false) as TextView
                chip.text = "✨ $action"
                chipsContainer.addView(chip)
            }
        }
        
        val btnClose = findViewById<MaterialButton>(R.id.btnClose)
        btnClose.setOnClickListener { finish() }
    }

    companion object {
        const val EXTRA_PHONE_NUMBER = "phone_number"
        const val EXTRA_SUMMARY = "summary"
        const val EXTRA_KEY_POINTS = "key_points"
        const val EXTRA_ACTION_ITEMS = "action_items"

        fun start(context: Context, phone: String, summary: String, keyPoints: List<String>, actionItems: List<String>) {
            val intent = Intent(context, PostCallSummaryActivity::class.java).apply {
                putExtra(EXTRA_PHONE_NUMBER, phone)
                putExtra(EXTRA_SUMMARY, summary)
                putStringArrayListExtra(EXTRA_KEY_POINTS, ArrayList(keyPoints))
                putStringArrayListExtra(EXTRA_ACTION_ITEMS, ArrayList(actionItems))
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            context.startActivity(intent)
        }
    }
}
