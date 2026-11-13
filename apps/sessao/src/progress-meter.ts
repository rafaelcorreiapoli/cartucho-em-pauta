export function updateProgress(meter:HTMLProgressElement,value:number,max:number) {
  meter.max = max;
  meter.value = value;
  const ratio = String(meter.position);
  if (!meter.classList.contains('animated-progress')) {
    meter.style.setProperty('--meter-ratio',ratio);
    meter.classList.add('animated-progress');
  } else if (meter.style.getPropertyValue('--meter-ratio')!==ratio) {
    meter.style.setProperty('--meter-ratio',ratio);
  }
}
