"""
Audio Recording Utility
Records audio from microphone for VoiceVault
"""
import os
import wave
import time
import tempfile
import subprocess
import threading
import sys
from pathlib import Path

try:
    import sounddevice as sd
    import numpy as np
    AUDIO_MONITORING_AVAILABLE = True
except ImportError:
    AUDIO_MONITORING_AVAILABLE = False


class AudioRecorder:
    """
    Record audio from microphone with real-time visual feedback
    """
    
    def __init__(self, sample_rate=16000, channels=1, output_dir=None):
        """
        Initialize audio recorder
        
        Args:
            sample_rate: Sample rate in Hz (16000 for speech is optimal)
            channels: Number of audio channels (1=mono, 2=stereo)
            output_dir: Directory to save recordings (default: project_root/temp_recordings)
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.recordings = []
        self.current_audio_level = 0.0  # 0.0 to 1.0
        self.audio_level_lock = threading.Lock()
        
        # Set output directory
        if output_dir:
            self.output_dir = output_dir
        else:
            # Use project root/temp_recordings
            project_root = Path(__file__).parent.parent
            self.output_dir = project_root / "temp_recordings"
        
        # Create directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
    
    def _monitor_audio_levels(self, duration_seconds):
        """
        Monitor audio input levels in real-time (runs in background thread)
        Updates self.current_audio_level based on actual microphone input
        """
        if not AUDIO_MONITORING_AVAILABLE:
            return
        
        try:
            start_time = time.time()
            
            def audio_callback(indata, frames, time_info, status):
                """Callback function to process audio input"""
                if status:
                    return
                
                # Calculate RMS (Root Mean Square) amplitude
                rms = np.sqrt(np.mean(indata**2))
                
                # Normalize to 0.0 - 1.0 range
                # Adjust sensitivity (typical speech is around 0.01-0.1 RMS)
                normalized_level = min(1.0, rms * 20.0)
                
                # Update shared variable
                with self.audio_level_lock:
                    self.current_audio_level = normalized_level
            
            # Open input stream
            with sd.InputStream(
                callback=audio_callback,
                channels=self.channels,
                samplerate=self.sample_rate,
                blocksize=1024
            ):
                # Keep monitoring while recording
                while time.time() - start_time < duration_seconds + 1:
                    time.sleep(0.05)
            
        except Exception as e:
            # If monitoring fails, just continue without it
            pass
    
    def _get_waveform_pattern(self, level):
        """
        Get waveform pattern based on audio level (0.0 to 1.0)
        Higher levels = bigger waves, lower/silence = flat line
        """
        if level < 0.05:  # Silence/very quiet
            return "▁▁▁▁▁▁▁▁▁"
        elif level < 0.15:  # Very low
            return "▁▁▂▂▂▂▂▁▁"
        elif level < 0.3:  # Low
            return "▁▂▃▃▃▃▃▂▁"
        elif level < 0.5:  # Medium
            return "▂▃▄▅▅▅▄▃▂"
        elif level < 0.7:  # High
            return "▃▄▅▆▇▆▅▄▃"
        else:  # Very high
            return "▄▅▆▇█▇▆▅▄"
    
    def record_question(self, question_text, duration_seconds=60, output_path=None):
        """
        Record audio for a single question with visual feedback
        
        Args:
            question_text: The question being answered
            duration_seconds: Maximum recording duration
            output_path: Where to save the recording (optional)
        
        Returns:
            Path to the recorded audio file
        """
        print(f"\n{'='*80}")
        print(f"🎙️  RECORDING")
        print(f"{'='*80}")
        print(f"\n📝 Question: {question_text}\n")
        print(f"⏱️  Duration: Up to {duration_seconds} seconds")
        print(f"   Press ENTER to start recording...")
        
        input()  # Wait for user to press Enter
        
        # Generate output path if not provided
        if not output_path:
            output_path = os.path.join(
                self.output_dir,
                f"voicevault_q{len(self.recordings)+1}_{int(time.time())}.wav"
            )
        
        print(f"\n🔴 RECORDING... Press Ctrl+C to stop\n")
        
        # Recording state
        recording_state = {
            'active': True,
            'start_time': time.time(),
            'process': None,
            'error': None
        }
        
        def run_ffmpeg():
            """Run ffmpeg in background thread"""
            try:
                recording_state['process'] = subprocess.Popen([
                    'ffmpeg',
                    '-f', 'avfoundation' if os.uname().sysname == 'Darwin' else 'alsa',
                    '-i', ':0' if os.uname().sysname == 'Darwin' else 'default',
                    '-t', str(duration_seconds),
                    '-ar', str(self.sample_rate),
                    '-ac', str(self.channels),
                    '-y',
                    output_path
                ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
                
                # Wait for process to complete
                recording_state['process'].wait()
                recording_state['active'] = False
                
            except Exception as e:
                recording_state['error'] = str(e)
                recording_state['active'] = False
        
        # Start recording in background thread
        record_thread = threading.Thread(target=run_ffmpeg, daemon=True)
        record_thread.start()
        
        # Start audio level monitoring if sounddevice is available
        if AUDIO_MONITORING_AVAILABLE:
            monitor_thread = threading.Thread(
                target=self._monitor_audio_levels,
                args=(duration_seconds,),
                daemon=True
            )
            monitor_thread.start()
        else:
            # Fallback message
            print("   (Install sounddevice for real-time level visualization: pip install sounddevice numpy)")
        
        # Wait a moment for threads to start
        time.sleep(0.5)
        
        try:
            # Show visual feedback while recording
            while recording_state['active']:
                elapsed = time.time() - recording_state['start_time']
                
                # Stop if we've reached max duration
                if elapsed >= duration_seconds:
                    recording_state['active'] = False
                    break
                
                # Get current audio level
                with self.audio_level_lock:
                    current_level = self.current_audio_level
                
                # Get waveform pattern based on actual audio level
                pattern = self._get_waveform_pattern(current_level)
                
                # Add indicator for voice detection
                if current_level > 0.15:
                    voice_indicator = "🎤"  # Voice detected
                else:
                    voice_indicator = "🔇"  # Silence
                
                elapsed_str = f"{int(elapsed)}s"
                remaining = max(0, duration_seconds - int(elapsed))
                
                # Show level bar
                level_bars = int(current_level * 10)
                level_bar = "█" * level_bars + "░" * (10 - level_bars)
                
                # Print animated line with real-time level
                sys.stdout.write(
                    f"\r   {voice_indicator} [{pattern}] {level_bar} {elapsed_str:>4}/{duration_seconds}s "
                    f"(remaining: {remaining}s)   "
                )
                sys.stdout.flush()
                
                time.sleep(0.1)  # Update 10 times per second
            
            # Clear the line
            sys.stdout.write("\r" + " " * 80 + "\r")
            sys.stdout.flush()
            
        except KeyboardInterrupt:
            print("\n\n⏹️  Stopping recording...")
            recording_state['active'] = False
            
            # Terminate ffmpeg process
            if recording_state['process']:
                recording_state['process'].terminate()
                try:
                    recording_state['process'].wait(timeout=2)
                except:
                    recording_state['process'].kill()
        
        # Wait for recording thread to finish
        record_thread.join(timeout=3)
        
        # Check results
        if recording_state['error']:
            print(f"\n❌ Recording error: {recording_state['error']}")
            return None
        
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            
            # Check if file has actual audio data
            if file_size < 1000:  # Less than 1KB is probably empty
                print(f"\n⚠️  Recording too small ({file_size} bytes)")
                print(f"   Microphone may not have captured audio")
                return None
            
            elapsed = time.time() - recording_state['start_time']
            print(f"\n✅ Recording complete!")
            print(f"   Duration: {elapsed:.1f}s")
            print(f"   File: {os.path.basename(output_path)}")
            print(f"   Size: {file_size / 1024:.2f} KB")
            
            self.recordings.append(output_path)
            return output_path
        else:
            print(f"\n❌ Recording failed - no output file created")
            
            # Try to get error from ffmpeg
            if recording_state['process'] and recording_state['process'].stderr:
                stderr = recording_state['process'].stderr.read()
                if "Authorization" in stderr or "permission" in stderr.lower():
                    print(f"\n   ⚠️  MICROPHONE PERMISSION DENIED")
                    print(f"   Fix: System Settings → Privacy & Security → Microphone")
                elif "Device" in stderr or "Input/output error" in stderr:
                    print(f"\n   ⚠️  MICROPHONE NOT FOUND")
                    print(f"   Check: Is a microphone connected?")
            
            return None
    
    def combine_recordings(self, output_path=None, compress=True):
        """
        Combine all recordings into a single file
        
        Args:
            output_path: Where to save the combined file
            compress: Whether to compress the output
        
        Returns:
            Path to the combined audio file
        """
        if not self.recordings:
            raise ValueError("No recordings to combine")
        
        print(f"\n{'='*80}")
        print(f"🔗 COMBINING RECORDINGS")
        print(f"{'='*80}\n")
        print(f"📦 Combining {len(self.recordings)} recordings into one file...\n")
        
        # Generate output path if not provided
        if not output_path:
            output_path = os.path.join(
                self.output_dir,
                f"voicevault_session_{int(time.time())}.mp3"
            )
        
        try:
            # Create a temporary file list for ffmpeg
            list_file = os.path.join(tempfile.gettempdir(), 'concat_list.txt')
            with open(list_file, 'w') as f:
                for recording in self.recordings:
                    f.write(f"file '{recording}'\n")
            
            # Combine files using ffmpeg
            print("🔧 Combining audio files...")
            
            cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', list_file,
            ]
            
            # Add compression if requested
            if compress:
                cmd.extend([
                    '-ac', '1',        # Mono
                    '-b:a', '64k',     # 64kbps bitrate
                    '-ar', '16000',    # 16kHz sample rate
                ])
            
            cmd.extend(['-y', output_path])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0 and os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                
                print(f"✅ Combined successfully!")
                print(f"   File: {os.path.basename(output_path)}")
                print(f"   Size: {file_size / (1024*1024):.2f} MB")
                
                if compress:
                    total_original = sum(os.path.getsize(r) for r in self.recordings)
                    savings = total_original - file_size
                    print(f"   Savings: {savings / (1024*1024):.2f} MB ({(savings/total_original)*100:.1f}%)")
                
                # Clean up temporary files
                os.unlink(list_file)
                for recording in self.recordings:
                    try:
                        os.unlink(recording)
                    except:
                        pass
                
                return output_path
            else:
                print(f"❌ Combining failed: {result.stderr}")
                return None
        
        except Exception as e:
            print(f"❌ Error combining recordings: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return None
    
    @staticmethod
    def test_microphone():
        """
        Test if microphone is accessible
        
        Returns:
            bool: True if microphone works
        """
        print("\n🎤 Testing microphone access...")
        print("   (Recording 2 seconds of test audio...)\n")
        
        try:
            # Test 2-second recording
            test_file = os.path.join(tempfile.gettempdir(), 'mic_test.wav')
            
            # Remove old test file if exists
            if os.path.exists(test_file):
                os.unlink(test_file)
            
            result = subprocess.run([
                'ffmpeg',
                '-f', 'avfoundation' if os.uname().sysname == 'Darwin' else 'alsa',
                '-i', ':0' if os.uname().sysname == 'Darwin' else 'default',
                '-t', '2',
                '-y',
                test_file
            ], capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0 and os.path.exists(test_file):
                file_size = os.path.getsize(test_file)
                
                if file_size > 1000:  # At least 1KB
                    print(f"✅ Microphone is working! ({file_size / 1024:.2f} KB captured)\n")
                    os.unlink(test_file)
                    return True
                else:
                    print(f"⚠️  Microphone detected but no audio captured ({file_size} bytes)\n")
                    if os.path.exists(test_file):
                        os.unlink(test_file)
                    return False
            else:
                print(f"❌ Microphone test failed!\n")
                
                # Provide helpful error messages
                if "Authorization" in result.stderr or "permission" in result.stderr.lower():
                    print("   ⚠️  PERMISSION ISSUE:")
                    print("   macOS: System Settings → Privacy & Security → Microphone")
                    print("         Enable 'Terminal' or your IDE (VS Code, Cursor, etc.)\n")
                elif "Device" in result.stderr or "Input/output error" in result.stderr:
                    print("   ⚠️  NO MICROPHONE DETECTED:")
                    print("   • Check if microphone is connected")
                    print("   • Try a different microphone")
                    print("   • Check System Settings → Sound → Input\n")
                else:
                    print(f"   Error: {result.stderr[:300]}\n")
                
                return False
        
        except subprocess.TimeoutExpired:
            print("⏱️  Test timed out - microphone may be inaccessible\n")
            return False
        
        except Exception as e:
            print(f"❌ Microphone test error: {str(e)}\n")
            import traceback
            print(traceback.format_exc())
            return False


if __name__ == "__main__":
    # Test the microphone
    print("🎙️  VoiceVault Audio Recorder Test\n")
    
    if not AudioRecorder.test_microphone():
        print("❌ Microphone not available. Please check your system settings.")
    else:
        print("✅ Microphone ready for recording!")

