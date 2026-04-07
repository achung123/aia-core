import * as THREE from 'three';

console.log('Three.js r' + THREE.REVISION);

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

document.getElementById('app').textContent = 'All In Analytics — Three.js ready';
