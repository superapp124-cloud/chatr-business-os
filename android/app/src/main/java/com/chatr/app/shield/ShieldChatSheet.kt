package com.chatr.app.shield

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.chatr.app.R
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.UUID

class ShieldChatSheet : BottomSheetDialogFragment() {

    private lateinit var conversationId: String
    private lateinit var currentUserId: String
    private lateinit var adapter: ChatAdapter
    private lateinit var database: ShieldDatabase

    companion object {
        fun newInstance(conversationId: String, currentUserId: String): ShieldChatSheet {
            val args = Bundle().apply {
                putString("conversation_id", conversationId)
                putString("current_user_id", currentUserId)
            }
            return ShieldChatSheet().apply { arguments = args }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        conversationId = arguments?.getString("conversation_id") ?: ""
        currentUserId = arguments?.getString("current_user_id") ?: ""
        database = ShieldDatabase.get(requireContext())
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_shield_chat_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val recyclerView = view.findViewById<RecyclerView>(R.id.chatRecyclerView)
        adapter = ChatAdapter(currentUserId)
        
        val layoutManager = LinearLayoutManager(context)
        layoutManager.stackFromEnd = true
        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = adapter

        val input = view.findViewById<EditText>(R.id.messageInput)
        val btnSend = view.findViewById<View>(R.id.btnSend)

        btnSend.setOnClickListener {
            val text = input.text.toString().trim()
            if (text.isNotEmpty()) {
                sendMessage(text)
                input.text.clear()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            database.dao().getChatMessages(conversationId).collectLatest { messages ->
                adapter.submitList(messages)
                if (messages.isNotEmpty()) {
                    recyclerView.scrollToPosition(messages.size - 1)
                }
            }
        }
    }

    private fun sendMessage(content: String) {
        val entity = ShieldChatMessageEntity(
            id = UUID.randomUUID().toString(),
            conversationId = conversationId,
            senderId = currentUserId,
            content = content,
            createdAt = System.currentTimeMillis(),
            status = "sending"
        )
        
        // Save to Room immediately for local optimistic UI
        viewLifecycleOwner.lifecycleScope.launch {
            database.dao().upsertChatMessage(entity)
        }
        
        // Broadcast to ShieldChatService to sync with Supabase
        ShieldChatService.sendMessage(requireContext(), entity.id, conversationId, content)
    }
}

class ChatAdapter(private val currentUserId: String) : RecyclerView.Adapter<ChatAdapter.ChatViewHolder>() {

    private var messages: List<ShieldChatMessageEntity> = emptyList()

    fun submitList(newMessages: List<ShieldChatMessageEntity>) {
        messages = newMessages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_shield_chat_message, parent, false)
        return ChatViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatViewHolder, position: Int) {
        val message = messages[position]
        holder.bind(message, currentUserId)
    }

    override fun getItemCount(): Int = messages.size

    class ChatViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val content: TextView = view.findViewById(R.id.messageContent)
        private val time: TextView = view.findViewById(R.id.messageTime)

        fun bind(message: ShieldChatMessageEntity, currentUserId: String) {
            content.text = message.content
            
            // Format time
            val sdf = java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault())
            time.text = sdf.format(java.util.Date(message.createdAt))

            val isMe = message.senderId == currentUserId
            
            val parent = itemView as android.widget.LinearLayout
            parent.gravity = if (isMe) android.view.Gravity.END else android.view.Gravity.START
            
            content.layoutParams = (content.layoutParams as android.widget.LinearLayout.LayoutParams).apply {
                gravity = if (isMe) android.view.Gravity.END else android.view.Gravity.START
            }
            time.layoutParams = (time.layoutParams as android.widget.LinearLayout.LayoutParams).apply {
                gravity = if (isMe) android.view.Gravity.END else android.view.Gravity.START
            }
            
            if (isMe) {
                content.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#447C3AED")) // Accent tint
            } else {
                content.backgroundTintList = android.content.res.ColorStateList.valueOf(android.graphics.Color.parseColor("#33FFFFFF")) // Default glass
            }
        }
    }
}
