import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { XMarkIcon, MapPinIcon } from '@heroicons/react/24/solid';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

interface Props {
    gps: string; // "lat,lon"
    onClose: () => void;
}

// Create a custom icon using HeroIcons SVG
const customIcon = L.divIcon({
    className: 'custom-map-marker',
    html: renderToStaticMarkup(
        <div className="text-red-600 drop-shadow-lg filter">
            <MapPinIcon className="w-10 h-10" />
        </div>
    ),
    iconSize: [40, 40],
    iconAnchor: [20, 40], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -40] // Point from which the popup should open relative to the iconAnchor
});


export function MapModal({ gps, onClose }: Props) {
    const [lat, lon] = gps.split(',').map(s => parseFloat(s.trim()));

    if (isNaN(lat) || isNaN(lon)) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 md:p-8" onClick={onClose}>
            <div className="bg-white w-full h-full rounded-xl shadow-2xl overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
                <div className="absolute top-4 right-4 z-[999]">
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-gray-900" />
                    </button>
                </div>

                <MapContainer center={[lat, lon]} zoom={15} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[lat, lon]} icon={customIcon}>
                        <Popup>
                            <div className="text-sm font-medium">
                                {lat}, {lon}
                            </div>
                        </Popup>
                    </Marker>
                </MapContainer>
            </div>
        </div>
    );
}
