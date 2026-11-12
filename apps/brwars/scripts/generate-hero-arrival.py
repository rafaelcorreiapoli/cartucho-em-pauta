"""Original celestial chord: additive bells, soft harmonic pad and stereo echoes."""
import math, wave, array
from pathlib import Path
rate=44100
duration=3.5
length=int(rate*duration)
dry=[0.0]*length
for freq,delay,volume in [(261.6256,0,.15),(329.6276,.09,.12),(392,.18,.12),(523.2511,.28,.1),(1046.5023,.02,.13),(1318.5102,.14,.1),(1567.9817,.26,.08)]:
 for i in range(int(delay*rate),length):
  t=i/rate-delay
  attack=1-math.exp(-t*25)
  decay=math.exp(-t*(1.65 if freq>800 else 1.1))
  vibrato=.002*math.sin(2*math.pi*4*t)
  tone=math.sin(2*math.pi*freq*t+vibrato)+.18*math.sin(2*math.pi*freq*2*t)+.06*math.sin(2*math.pi*freq*3*t)
  dry[i]+=tone*attack*decay*volume
stereo=[]
for i in range(length):
 channels=[]
 for channel in range(2):
  value=dry[i]
  for delay,gain in [(0.137,.28),(.251,.20),(.389,.13),(.571,.09),(.811,.06)]:
   j=i-int((delay+channel*.013)*rate)
   if j>=0:value+=dry[j]*gain
  fade=min(1,(length-i)/(rate*.3))
  channels.append(value*fade)
 stereo.extend(channels)
peak=max(abs(v) for v in stereo)
frames=array.array('h',(round(v/peak*26000) for v in stereo))
path=Path('/tmp/brwars-hero-arrival.wav')
with wave.open(str(path),'wb') as out:
 out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate);out.writeframes(frames.tobytes())
print(path)
