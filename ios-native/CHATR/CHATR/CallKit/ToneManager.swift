import AVFoundation
import Foundation

enum CallTone: String {
    case ringback = "RINGBACK"
    case busy = "BUSY"
    case failed = "FAILED"
    case ended = "ENDED"
    case reconnecting = "RECONNECTING"
}

final class ToneManager {
    static let shared = ToneManager()

    var onAutoDisconnect: ((String?, CallTone) -> Void)?

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let session = AVAudioSession.sharedInstance()
    private let sampleRate: Double = 44_100
    private var buffers: [CallTone: AVAudioPCMBuffer] = [:]
    private var loopTimer: Timer?
    private var sequenceTimers: [Timer] = []
    private var autoDisconnectTimer: Timer?
    private var currentTone: CallTone?
    private var currentCallId: String?
    private var pausedTone: CallTone?
    private var pausedCallId: String?
    private var muted = false

    private init() {
        buildBuffers()
        configureEngine()
    }

    func playTone(_ tone: CallTone, callId: String? = nil) {
        dispatchPreconditionOrAsync { [weak self] in
            self?.playToneOnMain(tone, callId: callId)
        }
    }

    func playTone(named rawTone: String?, callId: String? = nil) {
        guard let rawTone,
              let tone = CallTone(rawValue: rawTone.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()) else {
            return
        }
        playTone(tone, callId: callId)
    }

    func stopTone() {
        dispatchPreconditionOrAsync { [weak self] in
            self?.stopToneOnMain(deactivateSession: true)
        }
    }

    func pauseTone() {
        dispatchPreconditionOrAsync { [weak self] in
            guard let self else { return }
            pausedTone = currentTone
            pausedCallId = currentCallId
            stopToneOnMain(deactivateSession: false)
        }
    }

    func resumeTone() {
        dispatchPreconditionOrAsync { [weak self] in
            guard let self, let tone = pausedTone else { return }
            let callId = pausedCallId
            pausedTone = nil
            pausedCallId = nil
            playToneOnMain(tone, callId: callId)
        }
    }

    func setMuted(_ isMuted: Bool) {
        dispatchPreconditionOrAsync { [weak self] in
            guard let self else { return }
            muted = isMuted
            if isMuted {
                pauseTone()
            }
        }
    }

    private func playToneOnMain(_ tone: CallTone, callId: String?) {
        guard !muted else { return }
        stopToneOnMain(deactivateSession: false)
        configureSession()

        if !engine.isRunning {
            do {
                try engine.start()
            } catch {
                print("ToneManager engine start failed: \(error)")
                return
            }
        }

        currentTone = tone
        currentCallId = callId

        switch tone {
        case .ringback:
            scheduleLoop(tone, every: 6.0)
        case .busy:
            scheduleLoop(tone, every: 1.0)
            scheduleAutoDisconnect(tone, after: 6.5)
        case .reconnecting:
            scheduleLoop(tone, every: 1.4)
        case .failed:
            scheduleSequence(tone, offsets: [0.0, 0.26, 0.52])
            scheduleAutoDisconnect(tone, after: 1.15)
        case .ended:
            playBuffer(for: tone)
            scheduleStop(after: 0.65)
        }
    }

    private func configureSession() {
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.duckOthers, .allowBluetooth, .allowBluetoothA2DP]
            )
            try session.setActive(true)
        } catch {
            print("ToneManager audio session failed: \(error)")
        }
    }

    private func configureEngine() {
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else {
            return
        }
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.prepare()
    }

    private func buildBuffers() {
        buffers[.ringback] = makeToneBuffer(primaryHz: 425, secondaryHz: 475, duration: 2.0, gain: 0.10)
        buffers[.busy] = makeToneBuffer(primaryHz: 425, duration: 0.5, gain: 0.13)
        buffers[.failed] = makeToneBuffer(primaryHz: 620, secondaryHz: 780, duration: 0.16, gain: 0.12)
        buffers[.ended] = makeToneBuffer(primaryHz: 330, secondaryHz: 262, duration: 0.24, gain: 0.07)
        buffers[.reconnecting] = makeToneBuffer(primaryHz: 520, secondaryHz: 660, duration: 0.36, gain: 0.06)
    }

    private func makeToneBuffer(
        primaryHz: Double,
        secondaryHz: Double? = nil,
        duration: Double,
        gain: Double
    ) -> AVAudioPCMBuffer? {
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else {
            return nil
        }

        let frameCount = AVAudioFrameCount(duration * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount),
              let channel = buffer.floatChannelData?[0] else {
            return nil
        }

        buffer.frameLength = frameCount
        let fadeFrames = Int(sampleRate * 0.012)

        for frame in 0..<Int(frameCount) {
            let primary = sin(2.0 * Double.pi * primaryHz * Double(frame) / sampleRate)
            let secondary = secondaryHz.map {
                sin(2.0 * Double.pi * $0 * Double(frame) / sampleRate) * 0.35
            } ?? 0
            let envelope: Double
            if frame < fadeFrames {
                envelope = Double(frame) / Double(fadeFrames)
            } else if frame > Int(frameCount) - fadeFrames {
                envelope = Double(Int(frameCount) - frame) / Double(fadeFrames)
            } else {
                envelope = 1.0
            }
            channel[frame] = Float(max(-1.0, min(1.0, ((primary * 0.75) + secondary) * gain * envelope)))
        }

        return buffer
    }

    private func scheduleLoop(_ tone: CallTone, every interval: TimeInterval) {
        playBuffer(for: tone)
        loopTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self, currentTone == tone, !muted else { return }
            playBuffer(for: tone)
        }
    }

    private func scheduleSequence(_ tone: CallTone, offsets: [TimeInterval]) {
        offsets.forEach { offset in
            let timer = Timer.scheduledTimer(withTimeInterval: offset, repeats: false) { [weak self] _ in
                guard let self, currentTone == tone, !muted else { return }
                playBuffer(for: tone)
            }
            sequenceTimers.append(timer)
        }
    }

    private func scheduleAutoDisconnect(_ tone: CallTone, after delay: TimeInterval) {
        autoDisconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            guard let self, currentTone == tone else { return }
            let callId = currentCallId
            stopToneOnMain(deactivateSession: true)
            onAutoDisconnect?(callId, tone)
        }
    }

    private func scheduleStop(after delay: TimeInterval) {
        autoDisconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.stopToneOnMain(deactivateSession: true)
        }
    }

    private func playBuffer(for tone: CallTone) {
        guard let buffer = buffers[tone] else { return }
        player.stop()
        player.scheduleBuffer(buffer, at: nil, options: [])
        player.play()
    }

    private func stopToneOnMain(deactivateSession: Bool) {
        loopTimer?.invalidate()
        loopTimer = nil

        sequenceTimers.forEach { $0.invalidate() }
        sequenceTimers.removeAll()

        autoDisconnectTimer?.invalidate()
        autoDisconnectTimer = nil

        player.stop()
        currentTone = nil
        currentCallId = nil

        if deactivateSession {
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func dispatchPreconditionOrAsync(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }
}
