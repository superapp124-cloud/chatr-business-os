package com.chatr.app.shield

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "shield_chat_messages",
    indices = [
        Index(value = ["conversationId"]),
        Index(value = ["createdAt"])
    ]
)
data class ShieldChatMessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val senderId: String,
    val content: String,
    val createdAt: Long,
    val status: String = "sent" // sending, sent, delivered, read, failed
)
