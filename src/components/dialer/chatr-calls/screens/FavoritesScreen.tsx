import React from 'react';
import { Plus, Star } from 'lucide-react';
import { MOCK_RECENTS } from '../mockData';
import CallerRow from '../CallerRow';
import '../calls.css';

const FavoritesScreen: React.FC = () => {
 const favorites: any[] = [];

 return (
 <div className="screen-container">
 <div className="flex justify-between items-center mt-10 mb-4">
 <button className="text-primary"><Plus size={24} /></button>
 <button className="text-primary font-semibold">Edit</button>
 </div>
 <h1 className="large-title">Favorites</h1>
 
 {favorites.length > 0 ? (
 <div className="favorites-list">
 {favorites.map(fav => (
 <CallerRow 
 key={fav.id} 
 caller={fav} 
 onClick={() => {}} 
 onInfoClick={() => {}} 
 />
 ))}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
 <Star size={32} className="text-muted-foreground" />
 </div>
 <h2 className="text-workspace mb-2">No Favorites</h2>
 <p className="text-muted-foreground">Add contacts to your favorites to quickly call them.</p>
 </div>
 )}
 </div>
 );
};

export default FavoritesScreen;
