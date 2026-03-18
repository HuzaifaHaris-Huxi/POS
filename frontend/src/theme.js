import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#EA5E28',       // --color-primary
    },
    background: {
      default: '#ffffff',
      paper: '#F8FAFD',      // --color-nav-bg
    },
    action: {
      hover: '#E9EEF6',      // --color-btn-hover
      selected: '#403d39',   // --color-btn-active
    },
    secondary: {
      main: '#403d39',       // --color-btn-active
    }
  },
  typography: {
    fontFamily: '"Google Sans", system-ui, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          '&:hover': {
            backgroundColor: '#E9EEF6',
          },
          '&.Mui-selected': {
            backgroundColor: '#403d39',
            color: '#ffffff',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#F8FAFD',
          color: '#000000',
          boxShadow: 'none',
          borderBottom: '1px solid #E0E0E0',
        },
      },
    },
  },
});

export default theme;

