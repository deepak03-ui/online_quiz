import React, { useState, useEffect } from 'react';  
import { useNavigate, useLocation } from 'react-router-dom';  
import { useAuth } from '../../context/AuthContext';  
import { Box, Container, Typography, Button, Grid, Paper, Fade } from '@mui/material';  
import {   
  School, Security, Analytics, Schedule,   
  VerifiedUser, Speed, Groups, Accessibility   
} from '@mui/icons-material';  
  
// Components  
import HeroSection from './components/HeroSection';  
import FeaturesSection from './components/FeaturesSection';  
import RoleSections from './components/RoleSections';  
import StatsSection from './components/StatsSection';  
import Testimonials from './components/Testimonials';  
import CTASection from './components/CTASection';  
import Footer from './components/Footer';  
  
// Animation & Utility  
import { motion } from 'framer-motion';  
import AOS from 'aos';  
import 'aos/dist/aos.css';  
  
// Styles  
import './styles/Home.module.css';  
  
const Home = () => {  
  const { user, userProfile, loading } = useAuth();  
  const navigate = useNavigate();  
  const location = useLocation();  
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);  
  
  useEffect(() => {  
    // Initialize AOS for animations  
    AOS.init({  
      duration: 1000,  
      once: true,  
      offset: 100,  
    });  
  
    // Check if user came from a protected route  
    if (location.state?.from && !user) {  
      setShowLoginPrompt(true);  
    }  
  
    // Scroll to top on mount  
    window.scrollTo(0, 0);  
  }, [location.state, user]);  
  
  const handleLogin = () => {  
    navigate('/login', { state: { from: location.pathname } });  
  };  
  
  const handleRegister = () => {  
    navigate('/register');  
  };  
  
  const handleDashboard = () => {  
    if (user) {  
      navigate('/dashboard');  
    } else {  
      setShowLoginPrompt(true);  
    }  
  };  
  
  if (loading) {  
    return (  
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>  
        <motion.div  
          initial={{ opacity: 0 }}  
          animate={{ opacity: 1 }}  
          transition={{ duration: 0.5 }}  
        >  
          <CircularProgress size={60} />  
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>  
            Loading Protector Portal...  
          </Typography>  
        </motion.div>  
      </Box>  
    );  
  }  
  
  return (  
    <Box sx={{ overflowX: 'hidden' }}>  
      {/* Login Prompt Modal */}  
      {showLoginPrompt && !user && (  
        <Paper  
          elevation={24}  
          sx={{  
            position: 'fixed',  
            top: '20%',  
            left: '50%',  
            transform: 'translateX(-50%)',  
            zIndex: 1300,  
            maxWidth: 500,  
            width: '90%',  
            p: 4,  
            borderRadius: 3,  
            bgcolor: 'background.paper',  
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',  
          }}  
        >  
          <Typography variant="h5" gutterBottom align="center" color="primary">  
            🔐 Access Required  
          </Typography>  
          <Typography variant="body1" gutterBottom align="center" sx={{ mb: 3 }}>  
            To continue to the dashboard, please log in to your account.  
          </Typography>  
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>  
            <Button  
              variant="contained"  
              size="large"  
              onClick={handleLogin}  
              startIcon={<LockIcon />}  
              sx={{ minWidth: 120 }}  
            >  
              Login  
            </Button>  
            <Button  
              variant="outlined"  
              size="large"  
              onClick={() => setShowLoginPrompt(false)}  
              sx={{ minWidth: 120 }}  
            >  
              Later  
            </Button>  
          </Box>  
        </Paper>  
      )}  
  
      {/* Overlay for modal */}  
      {showLoginPrompt && (  
        <Box  
          sx={{  
            position: 'fixed',  
            top: 0,  
            left: 0,  
            width: '100%',  
            height: '100%',  
            bgcolor: 'rgba(0,0,0,0.5)',  
            zIndex: 1200,  
          }}  
          onClick={() => setShowLoginPrompt(false)}  
        />  
      )}  
  
      {/* Main Content */}  
      <Box>  
        {/* Hero Section */}  
        <HeroSection   
          user={user}  
          handleLogin={handleLogin}  
          handleRegister={handleRegister}  
          handleDashboard={handleDashboard}  
        />  
  
        {/* Features Section */}  
        <FeaturesSection />  
  
        {/* Role Sections */}  
        <RoleSections />  
  
        {/* Statistics Section */}  
        <StatsSection />  
  
        {/* Testimonials */}  
        <Testimonials />  
  
        {/* Final CTA */}  
        <CTASection   
          user={user}  
          handleLogin={handleLogin}  
          handleRegister={handleRegister}  
          handleDashboard={handleDashboard}  
        />  
  
        {/* Footer */}  
        <Footer />  
      </Box>  
    </Box>  
  );  
};  
  
export default Home;  
