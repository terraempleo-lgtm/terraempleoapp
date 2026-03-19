import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';

const CONTENIDOS = {
  habeas: {
    titulo: 'Autorizacion de Habeas Data',
    subtitulo: 'Tratamiento de datos personales - Ley 1581 de 2012',
    secciones: [
      {
        titulo: '1. Finalidad del tratamiento',
        texto:
          'TerraEmpleo tratara los datos personales para crear y administrar tu cuenta, validar identidad, publicar perfiles y vacantes, facilitar procesos de postulacion y mantener comunicacion sobre el servicio.',
      },
      {
        titulo: '2. Datos que se recolectan',
        texto:
          'Se pueden recolectar datos de identificacion, contacto, ubicacion, experiencia laboral y documentos de verificacion (como fotos de cédula y selfie) cuando sean necesarios para la operacion de la plataforma.',
      },
      {
        titulo: '3. Derechos del titular',
        texto:
          'Como titular puedes conocer, actualizar, rectificar o solicitar la supresion de tus datos, asi como revocar esta autorizacion cuando proceda legalmente.',
      },
      {
        titulo: '4. Seguridad y confidencialidad',
        texto:
          'TerraEmpleo adopta medidas razonables de seguridad para proteger tu informacion contra perdida, acceso no autorizado, uso indebido o divulgacion.',
      },
      {
        titulo: '5. Aceptacion',
        texto:
          'Al activar la opcion de aceptacion, autorizas de manera previa, expresa e informada el tratamiento de tus datos personales para las finalidades aqui descritas.',
      },
    ],
  },
  terminos: {
    titulo: 'Terminos y Condiciones de Uso',
    subtitulo: 'Condiciones para trabajadores y empleadores',
    secciones: [
      {
        titulo: '1. Uso de la plataforma',
        texto:
          'TerraEmpleo conecta trabajadores y empleadores del sector rural. El usuario se compromete a usar la plataforma de buena fe y con informacion veraz.',
      },
      {
        titulo: '2. Cuenta y acceso',
        texto:
          'Cada usuario es responsable de la custodia de su cuenta y credenciales. No se permite suplantacion, uso fraudulento ni creacion de perfiles falsos.',
      },
      {
        titulo: '3. Publicaciones y contenido',
        texto:
          'Vacantes, perfiles, mensajes y demas contenidos deben cumplir la ley y no incluir informacion enganosa, ofensiva o que afecte derechos de terceros.',
      },
      {
        titulo: '4. Verificacion de identidad',
        texto:
          'Para proteger la comunidad, TerraEmpleo puede solicitar y revisar evidencia de identidad. El estado de verificacion puede ser pendiente, aprobada o rechazada.',
      },
      {
        titulo: '5. Suspension de cuenta',
        texto:
          'TerraEmpleo puede suspender o desactivar cuentas por incumplimiento de estas condiciones, fraude, suplantacion o cualquier uso indebido del servicio.',
      },
      {
        titulo: '6. Aceptacion',
        texto:
          'Al activar la opcion de aceptacion, declaras que leiste y aceptas estos terminos y condiciones para el uso de la plataforma TerraEmpleo.',
      },
    ],
  },
};

export default function DocumentoLegalScreen({ route }) {
  const tipo = route?.params?.tipo === 'terminos' ? 'terminos' : 'habeas';

  const contenido = useMemo(() => {
    return CONTENIDOS[tipo];
  }, [tipo]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.titulo}>{contenido.titulo}</Text>
          <Text style={styles.subtitulo}>{contenido.subtitulo}</Text>
        </View>

        {contenido.secciones.map((seccion) => (
          <View key={seccion.titulo} style={styles.seccionCard}>
            <Text style={styles.seccionTitulo}>{seccion.titulo}</Text>
            <Text style={styles.seccionTexto}>{seccion.texto}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitulo: {
    marginTop: 4,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  seccionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  seccionTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  seccionTexto: {
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
});
