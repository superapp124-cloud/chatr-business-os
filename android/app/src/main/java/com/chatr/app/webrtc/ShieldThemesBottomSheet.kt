package com.chatr.app.webrtc

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.chatr.app.R

class ShieldThemesBottomSheet : BottomSheetDialogFragment() {

    interface ThemesSheetListener {
        fun onThemeSelected(themeName: String)
    }

    var listener: ThemesSheetListener? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.layout_shield_themes_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val clickListener = View.OnClickListener { v ->
            val themeName = when (v.id) {
                R.id.btnThemeCosmic -> "Cosmic"
                R.id.btnThemeAurora -> "Aurora"
                R.id.btnThemeMidnight -> "Midnight"
                R.id.btnThemeOcean -> "Ocean"
                R.id.btnThemeForest -> "Forest"
                R.id.btnThemeSunset -> "Sunset"
                R.id.btnThemeRoyal -> "Royal"
                R.id.btnThemeNone -> "None"
                else -> "None"
            }
            listener?.onThemeSelected(themeName)
            dismiss()
        }

        view.findViewById<View>(R.id.btnThemeCosmic)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeAurora)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeMidnight)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeOcean)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeForest)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeSunset)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeRoyal)?.setOnClickListener(clickListener)
        view.findViewById<View>(R.id.btnThemeNone)?.setOnClickListener(clickListener)
    }
}
