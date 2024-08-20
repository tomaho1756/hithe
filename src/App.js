import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { toast } from 'react-toastify';

const socket = io('https://10.80.162.142:3000',
    {secure: true,
      transports: ['websocket'],
    });

function App() {
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const peerConnection = useRef(null);
  const [cameraReady, setCameraReady] = useState(true);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('client-joined', (data) => toast.info(`Client joined: ${data.id}`));
    socket.on('client-left', (data) => toast.info(`Client left: ${data.id}`));
    socket.on('connect', () => toast.info('Connected to server'));
    socket.on('disconnect', () => toast.warn('Disconnected from server'));

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('client-joined');
      socket.off('client-left');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localStream.current) {
        localStream.current.srcObject = stream;
      }

      peerConnection.current = new RTCPeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate);
        }
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit('offer', offer);

      toast.success('Call started successfully');
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Error starting call: ' + error.message);
      setCameraReady(false);
    }
  };

  const handleOffer = async (offer) => {
    try {
      if (!peerConnection.current) {
        peerConnection.current = new RTCPeerConnection();
      }

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answer', answer);

      peerConnection.current.ontrack = (event) => {
        if (remoteStream.current) {
          remoteStream.current.srcObject = event.streams[0];
        }
      };

      toast.info('Received offer, sending answer');
    } catch (error) {
      console.error('Error handling offer:', error);
      toast.error('Error handling offer: ' + error.message);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      toast.success('Call established successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
      toast.error('Error handling answer: ' + error.message);
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      toast.error('Error handling ICE candidate: ' + error.message);
    }
  };

  const joinRoom = () => {
    if (roomId) {
      socket.emit('join-room', roomId);
      toast.info(`Joined room ${roomId}`);
    } else {
      toast.error('Room ID is required');
    }
  };

  const leaveRoom = () => {
    if (roomId) {
      socket.emit('leave-room', roomId);
      toast.info(`Left room ${roomId}`);
    }
  };

  return (
      <div>
        <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
        />
        <button onClick={joinRoom}>Join Room</button>
        <button onClick={leaveRoom}>Leave Room</button>
        {cameraReady ? (
            <div>
              <video ref={localStream} autoPlay muted></video>
              <video ref={remoteStream} autoPlay></video>
              <button onClick={startCall}>Start Call</button>
            </div>
        ) : (
            <p>Unable to access the camera.</p>
        )}
      </div>
  );
}

export default App;
