-- Create session_rooms table for multi-party group calls
CREATE TABLE session_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  session_goal text NOT NULL,
  room_name text,
  max_participants int DEFAULT 10,
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Create session_room_participants table
CREATE TABLE session_room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES session_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL, -- optional reference to the individual P2P leg
  UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE session_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_room_participants ENABLE ROW LEVEL SECURITY;

-- Policies for session_rooms
CREATE POLICY "Users can read rooms they are part of or host"
  ON session_rooms FOR SELECT
  USING (
    host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM session_room_participants
      WHERE room_id = session_rooms.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create rooms"
  ON session_rooms FOR INSERT
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host can update room"
  ON session_rooms FOR UPDATE
  USING (host_id = auth.uid());

-- Policies for session_room_participants
CREATE POLICY "Users can read participants of their rooms"
  ON session_room_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM session_room_participants p2
      WHERE p2.room_id = session_room_participants.room_id AND p2.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM session_rooms
      WHERE id = session_room_participants.room_id AND host_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert themselves"
  ON session_room_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participant status"
  ON session_room_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Create realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE session_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE session_room_participants;
