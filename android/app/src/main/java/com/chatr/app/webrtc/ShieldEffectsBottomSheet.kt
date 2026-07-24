package com.chatr.app.webrtc

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.chatr.app.R

class ShieldEffectsBottomSheet : BottomSheetDialogFragment() {

    interface EffectsSheetListener {
        fun onEffectSelected(effectName: String)
    }

    var listener: EffectsSheetListener? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.layout_shield_effects_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val clickListener = View.OnClickListener { v ->
            val effectName = when (v.id) {
                R.id.btnEffectBlur -> "Blur"
                R.id.btnEffectStudioLight -> "StudioLight"
                R.id.btnEffectBnW -> "BlackAndWhite"
                else -> "None"
            }
            listener?.onEffectSelected(effectName)
            dismiss()
        }

        view.findViewById<View>(R.id.btnEffectNone)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnEffectBlur)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnEffectStudioLight)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnEffectBnW)?.setOnClickListener(clickListener)
    }
}
