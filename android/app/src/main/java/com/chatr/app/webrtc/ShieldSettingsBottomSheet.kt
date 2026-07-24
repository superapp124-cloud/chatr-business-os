package com.chatr.app.webrtc

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Spinner
import androidx.appcompat.widget.SwitchCompat
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.chatr.app.R

class ShieldSettingsBottomSheet : BottomSheetDialogFragment() {

    interface SettingsSheetListener {
        fun onAudioDeviceChanged(device: String)
        fun onDataSaverToggled(enabled: Boolean)
        fun onLowLightToggled(enabled: Boolean)
    }

    var listener: SettingsSheetListener? = null
    var isDataSaverOn = false
    var isLowLightOn = false

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.layout_shield_settings_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val spinner = view.findViewById<Spinner>(R.id.spinnerAudioDevice)
        val audioDevices = arrayOf("Speakerphone", "Earpiece", "Bluetooth (if connected)")
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, audioDevices)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinner.adapter = adapter
        
        val dataSaverSwitch = view.findViewById<SwitchCompat>(R.id.switchDataSaver)
        dataSaverSwitch.isChecked = isDataSaverOn
        dataSaverSwitch.setOnCheckedChangeListener { _, isChecked ->
            listener?.onDataSaverToggled(isChecked)
        }
        
        val lowLightSwitch = view.findViewById<SwitchCompat>(R.id.switchLowLight)
        lowLightSwitch.isChecked = isLowLightOn
        lowLightSwitch.setOnCheckedChangeListener { _, isChecked ->
            listener?.onLowLightToggled(isChecked)
        }
    }
}
