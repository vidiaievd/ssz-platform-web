// The audio layer, student side — plan 56 phase 3.
//
// Exercise-type agnostic to a fault: nothing here knows what an item is, which is what
// lets one player mount on all thirteen templates.

export { useExerciseAudio } from './use-exercise-audio';
export type { ExerciseAudioEngine, UseExerciseAudioOptions } from './use-exercise-audio';
export { ExerciseAudioPlayer } from './exercise-audio-player';
export { AudioGateScreen, AudioLockNote, AudioSegmentButton, AudioTranscript } from './audio-parts';
