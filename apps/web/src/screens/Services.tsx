import { useState, useEffect } from "react";
import { getServices } from "@/lib/api";

const Services = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    getServices().then(setServices).catch(console.error);
  }, []);

  return (
    <div className="flex-1 p-6">
      <h2 className="text-xl font-semibold mb-4">Services</h2>
      {services.length > 0 ? (
        <ul className="list-disc pl-5">
          {services.map((service: any, index: number) => (
            <li key={index}>{service.name || JSON.stringify(service)}</li>
          ))}
        </ul>
      ) : (
        <p>No services found.</p>
      )}
    </div>
  );
};

export default Services;
