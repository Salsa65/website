import type {Metadata,Viewport} from 'next';
import './globals.css';
import PwaRegister from '@/components/pwa-register';
export const metadata:Metadata={title:'Reforge',description:'Cinematic story workshop with Myria',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={themeColor:'#b91535',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PwaRegister/>{children}</body></html>}
