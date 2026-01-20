import { Card, CardBody, CardHeader, Container } from 'reactstrap';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const staticData = [
  { date: 'Apr 01', dbu: 12 },
  { date: 'Apr 02', dbu: 18 },
  { date: 'Apr 03', dbu: 25 },
  { date: 'Apr 04', dbu: 15 },
  { date: 'Apr 05', dbu: 20 },
];

const UsageChart = () => {
  return (
    <Container>
    <Card className="shadow-sm" style={{ position: 'relative', overflow: 'hidden' }}>
      <CardHeader className="bg-primary text-white fw-bold w-100 m-0" style={{ fontSize: '1.25rem' }}>
        Usage
      </CardHeader>
      <CardBody className="position-relative p-3">
        <div style={{ height: 300, position: 'relative' }}>
          {/* Gray overlay for background chart */}


          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={staticData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="dbu" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>

          {/* Diagonal “Coming Soon” banner */}
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '-40%',
              width: '180%',
              height: '4rem',
              backgroundColor: 'rgba(255,255,255,0.8)',
              color: '#555',
              fontWeight: 'bold',
              fontSize: '1.8rem',
              textAlign: 'center',
              transform: 'rotate(-15deg)',
              zIndex: 10,
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              border: '2px dashed #ccc',
            }}
          >
            Coming Soon
          </div>
        </div>
      </CardBody>
    </Card>
    </Container>
  );
};

export default UsageChart;
