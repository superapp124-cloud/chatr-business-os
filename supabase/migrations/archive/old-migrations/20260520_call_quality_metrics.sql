-- CHATR+ Call Quality Benchmark Metrics Table
-- Used by src/services/callBenchmark.ts to persist telecom-grade KPIs
-- Run via: supabase db push or supabase migration up

CREATE TABLE IF NOT EXISTS call_quality_metrics (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id          text        NOT NULL,
  scenario         text        NOT NULL CHECK (scenario IN ('EDGE_2G','CONGESTED_LTE','WIFI_HANDOFF','RURAL_WEAK','NORMAL')),
  platform         text        NOT NULL CHECK (platform IN ('chatr','whatsapp','jiocall','baseline')),

  -- Core KPIs
  mos_score        numeric(4,2),   -- Mean Opinion Score 1.0-5.0, target >4.0
  packet_loss      numeric(5,2),   -- % packets lost, target <5%
  jitter_ms        integer,        -- Jitter in ms, target <30ms
  rtt_ms           integer,        -- Round-trip time ms, target <250ms
  setup_time_ms    integer,        -- Call setup time ms, target <3000ms
  reconnect_count  integer DEFAULT 0,
  bitrate_kbps     integer,        -- Audio bitrate kbps

  -- Audio quality
  audio_level      numeric(4,2),   -- 0.0-1.0 microphone input level
  concealed_samples bigint,        -- Samples concealed due to packet loss
  total_samples    bigint,         -- Total audio samples decoded

  -- Metadata
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_info      jsonb,          -- { os, model, ram_gb, android_version }
  network_info     jsonb,          -- { type: '2G'/'LTE'/'WiFi', carrier: 'Jio'/'Airtel' }
  created_at       timestamptz DEFAULT now() NOT NULL
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_cqm_platform_scenario ON call_quality_metrics (platform, scenario);
CREATE INDEX IF NOT EXISTS idx_cqm_user            ON call_quality_metrics (user_id);
CREATE INDEX IF NOT EXISTS idx_cqm_created         ON call_quality_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cqm_mos             ON call_quality_metrics (mos_score DESC);

-- RLS: Users can only read their own metrics; service role can write all
ALTER TABLE call_quality_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_metrics" ON call_quality_metrics
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "service_insert_metrics" ON call_quality_metrics
  FOR INSERT WITH CHECK (true);

-- Convenience view: average KPIs by platform × scenario
CREATE OR REPLACE VIEW call_benchmark_summary AS
SELECT
  platform,
  scenario,
  COUNT(*)                                    AS sample_count,
  ROUND(AVG(mos_score)::numeric, 2)           AS avg_mos,
  ROUND(AVG(packet_loss)::numeric, 2)         AS avg_packet_loss_pct,
  ROUND(AVG(jitter_ms))::integer              AS avg_jitter_ms,
  ROUND(AVG(rtt_ms))::integer                 AS avg_rtt_ms,
  ROUND(AVG(setup_time_ms))::integer          AS avg_setup_ms,
  ROUND(AVG(bitrate_kbps))::integer           AS avg_bitrate_kbps,
  MAX(created_at)                             AS last_measured_at
FROM call_quality_metrics
GROUP BY platform, scenario
ORDER BY platform, scenario;

COMMENT ON TABLE call_quality_metrics IS
  'Telecom-grade call quality KPIs collected by CHATR+ benchmark service. '
  'Enables side-by-side comparison vs WhatsApp / JioCall across Indian network conditions.';
