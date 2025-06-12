import { createSlice } from '@reduxjs/toolkit';

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState: [],
  reducers: {
    addSession: (state, action) => {
      state.push({ id: Date.now(), ...action.payload });
    }
  }
});

export const { addSession } = sessionsSlice.actions;
export default sessionsSlice.reducer;
