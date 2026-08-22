import { useState, useEffect } from "react";
import { getServices } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import {
  Clock,
  Pen,
  PhilippinePeso,
  Scissors,
  ServerCog,
  ServerIcon,
} from "lucide-react";

interface Services {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  is_active: boolean;
}

const Services = () => {
  const [services, setServices] = useState([]);

  useEffect(() => {
    getServices().then(setServices).catch(console.error);
  }, []);
  console.log(services);
  return (
    <div className=" p-6">
      <h2 className="text-xl font-semibold mb-4">Services</h2>
      {services.length > 0 ? (
        <div className="h-auto">
          {services.map((service: Services) => (
            <Card className="max-w-xs max-h-96 h-full w-full">
              <CardHeader className="flex  justify-between items-center">
                <div className="bg-accent/20 p-2 rounded-lg">
                  <Scissors />
                </div>
                <Badge
                  variant={"secondary"}
                  className="h-8 w-8 rounded-lg cursor-pointer"
                >
                  <Pen size={30} />
                </Badge>
              </CardHeader>
              <CardContent>
                <div>
                  <h1 className="text-2xl font-bold text-accent">
                    {service.name}
                  </h1>
                  <span className="text-muted-foreground">
                    {service.description}
                  </span>
                </div>
                <div className="w-full mt-5 flex justify-between">
                  <div className="flex items-center gap-1 justify-center">
                    <Clock color="#0d7680" size={15} />
                    <h1>{service.duration_minutes} min</h1>
                  </div>
                  <div className="flex items-center gap-1 justify-center">
                    <PhilippinePeso size={15} />
                    <h1>200</h1>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex w-full items-center justify-between">
                  <h1>Status</h1>
                  <span
                    className={`${service.is_active ? "bg-accent text-white" : "bg-muted text-muted-foreground"} font-bold text-xs rounded-full px-3 py-1`}
                  >
                    {service.is_active ? "Active" : "In-Active"}
                  </span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <p>No services found.</p>
      )}
    </div>
  );
};

export default Services;
