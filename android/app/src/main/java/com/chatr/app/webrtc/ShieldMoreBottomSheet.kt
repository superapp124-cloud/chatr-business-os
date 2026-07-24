package com.chatr.app.webrtc

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.chatr.app.R

class ShieldMoreBottomSheet : BottomSheetDialogFragment() {

    interface MoreSheetListener {
        fun onReactionClicked()
        fun onChatClicked()
        fun onZoomChanged(zoomLevel: Float)
        fun onThemeSelected(themeName: String)
        fun onAiAssistantClicked()
        fun onSnapshotClicked()
        fun onSettingsClicked()
        fun onEffectsClicked()
        fun onThemesMenuClicked()
        fun onScreenShareClicked()
    }

    var listener: MoreSheetListener? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.layout_shield_more_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val clickListener = View.OnClickListener { v ->
            when (v.id) {
                R.id.btnScreenShare -> listener?.onScreenShareClicked()
                R.id.btnSnapshot -> listener?.onSnapshotClicked()
                R.id.btnAiAssistant -> listener?.onAiAssistantClicked()
                R.id.btnBackground, R.id.btnEffects2 -> listener?.onEffectsClicked()
                R.id.btnThemes -> listener?.onThemesMenuClicked()
                R.id.btnSettings -> listener?.onSettingsClicked()
            }
            dismiss()
        }

        view.findViewById<View>(R.id.btnScreenShare)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnSnapshot)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnAiAssistant)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnBackground)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnEffects2)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemes)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnSettings)?.setOnClickListener(clickListener)
    }

}
