export const CONFIG = {
  maxSpeed: 83.3,  // 300 km/h
  engineForce: 4200,
  brakeForce: 80,
  // 转向角度：减小值以获得更精确的操控感
  steerAngle: 0.4,
  kartMass: 150,
  chassisW: 1.1, chassisH: 0.2, chassisL: 2.2,
  wheelRadius: 0.35,
  trackWidth: 14,
  trackSegments: 1000,
  totalLaps: 3,
  numAI: 3,
  // AI速度系数：索引越大越快（越困难），0.6≈180km/h，1.0≈300km/h
  aiSpeeds: [0.5, 0.7, 0.9, 0.95, 1.0],
  // AI加速度系数：索引越大加速越快
  aiAccels: [0.6, 0.75, 0.9, 0.95, 1.0],
  aiLookaheads: [3, 3, 2, 2, 2],
  cameraDistance: 8,
  cameraHeight: 3.5,
  colors: [0xe94560, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c],
  kartNames: ['玩家', '闪电', '疾风', '烈焰', '幻影', '雷霆']
};
