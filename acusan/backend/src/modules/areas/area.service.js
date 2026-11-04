// Áreas: lectura (GET /api/areas) y estructura (POST/PUT/PATCH/DELETE).
// Estructurar (crear, editar, activar/desactivar, eliminar) es EXCLUSIVO de
// gerencia (lider_general); la vista /estructura ya es solo de ese rol.
//
// El árbol del mapa de estructura crece con parentId: gerencia (raíz) →
// áreas operativas → subáreas sin límite de profundidad. Cada cambio queda
// registrado en MovimientoArea (creada, activada, desactivada, actualizada,
// eliminada) con snapshots: el registro sobrevive al área.

import bcrypt from 'bcryptjs'
import { COSTO_BCRYPT } from '../auth/auth.service.js'

import prisma from '../../config/prisma.js'
import { esLiderGeneral } from '../auth/permisos.js'

// Nunca se expone passwordHash fuera del servicio de login
const selectUsuarioPublico = { id: true, nombre: true, email: true, rol: true, activo: true }

// Separa el equipo del área en líder (rol LIDER_AREA, activo o no: gerencia
// debe VER que está inactivo) y miembros (USUARIO con acceso: solo activos)
function separarEquipo(usuarios) {
  return {
    lider: usuarios.find((u) => u.rol === 'LIDER_AREA') || null,
    miembros: usuarios.filter((u) => u.rol === 'USUARIO' && u.activo),
  }
}

// activa !== false: las áreas previas a la columna no la traen (Prisma la
// omite al crear) y cuentan como activas.
function conEquipo(area) {
  return {
    id: area.id,
    nombre: area.nombre,
    codigo: area.codigo,
    parentId: area.parentId,
    activa: area.activa !== false,
    // Fecha de creación del área: el mapa la muestra ("Desde …") como parte
    // de la información institucional de la estructura.
    creada: area.createdAt ? area.createdAt.toISOString() : null,
    ...separarEquipo(area.usuarios),
  }
}

// Movimiento de área con snapshots congelados (el registro históraico nunca
// pierde contexto aunque el área cambie de nombre o desaparezca).
async function registrarMovimiento(tx, { area, tipo, detalle = null, padreNombre = null, usuario }) {
  await tx.movimientoArea.create({
    data: {
      areaId: area.id,
      areaCodigo: area.codigo,
      areaNombre: area.nombre,
      tipo,
      detalle,
      padreNombre,
      usuarioId: usuario?.id || null,
      usuarioNombre: usuario?.nombre || 'Sistema',
    },
  })
}

export const AreaService = {
  /**
   * Areas con líder, miembros y estado activa/inactiva.
   * lider_general ve TODAS; lider_area y usuario solo la suya.
   * Siempre devuelve un arreglo (vacío si el área del usuario desapareció).
   */
  async listarAreas(usuario) {
    // Sin filtro de activo: el líder inactivo debe listarse (marcado como
    // tal); separarEquipo deja los miembros en solo-activos.
    const includeUsuarios = {
      usuarios: {
        select: selectUsuarioPublico,
        orderBy: { nombre: 'asc' },
      },
    }

    if (esLiderGeneral(usuario)) {
      const areas = await prisma.area.findMany({
        include: includeUsuarios,
      })
      // Área líder primero, resto por código
      return areas
        .map(conEquipo)
        .sort((a, b) => {
          if (!a.parentId) return -1
          if (!b.parentId) return 1
          return a.codigo.localeCompare(b.codigo)
        })
    }

    const area = await prisma.area.findUnique({
      where: { id: usuario.areaId },
      include: includeUsuarios,
    })
    return area ? [conEquipo(area)] : []
  },

  /**
   * Crea un área dependiente de otra. Sin parentId cuelga del área líder
   * (área operativa de gerencia y entonces el ENCARGADO es obligatorio);
   * con parentId puede ser subárea de cualquier área del árbol y el
   * encargado pasa a ser opcional (es una subdivisión, no un destino de
   * radicados). Todo en una transacción: o nace todo, o nada.
   * Solo gerencia (lider_general) estructura las áreas.
   */
  async crearArea(usuario, datos) {
    if (!esLiderGeneral(usuario)) {
      throw { status: 403, message: 'Solo gerencia puede estructurar las áreas.' }
    }

    const nombre = (datos.nombre || '').trim()
    const codigo = (datos.codigo || '').trim().toUpperCase()
    if (!nombre || !codigo) {
      throw { status: 400, message: 'El código y el nombre del área son obligatorios.' }
    }

    // Padre del área nueva: el indicado (subárea) o el área líder (raíz)
    const padre = datos.parentId
      ? await prisma.area.findUnique({ where: { id: datos.parentId } })
      : await prisma.area.findFirst({ where: { parentId: null } })
    if (!padre) {
      throw { status: 404, message: 'El área padre no existe.' }
    }
    const esSubarea = padre.parentId !== null

    const encargado = datos.encargado || {}
    const eNombre = (encargado.nombre || '').trim()
    const eEmail = (encargado.email || '').toLowerCase().trim()
    const ePassword = encargado.password || ''
    const conEncargado = Boolean(eNombre || eEmail || ePassword)

    // Área operativa de gerencia (cuelga de la raíz): el encargado es
    // obligatorio — es quien responde los radicados del área.
    if (!esSubarea && !conEncargado) {
      throw {
        status: 400,
        message: 'El encargado es obligatorio: nombre, correo electrónico y contraseña.',
      }
    }
    if (conEncargado && (!eNombre || !eEmail || !ePassword)) {
      throw {
        status: 400,
        message: 'El encargado es obligatorio: nombre, correo electrónico y contraseña.',
      }
    }

    const repetida = await prisma.area.findFirst({
      where: { OR: [{ nombre }, { codigo }] },
    })
    if (repetida) {
      throw repetida.nombre === nombre
        ? { status: 409, message: `Ya existe un área llamada "${nombre}".` }
        : { status: 409, message: `El código ${codigo} ya lo usa el área ${repetida.nombre}.` }
    }

    // El correo es único en todo el sistema (área y usuario en la misma petición)
    if (eEmail) {
      const emailDuplicado = await prisma.usuario.findUnique({ where: { email: eEmail } })
      if (emailDuplicado) {
        throw { status: 409, message: `Ya existe un usuario con el correo ${eEmail}.` }
      }
    }

    const passwordHash = conEncargado ? await bcrypt.hash(ePassword, COSTO_BCRYPT) : null
    const activo = encargado.activo !== false // por defecto, cuenta activa

    return prisma.$transaction(async (tx) => {
      const area = await tx.area.create({
        data: { nombre, codigo, parentId: padre.id },
        select: { id: true, nombre: true, codigo: true, parentId: true },
      })

      if (conEncargado) {
        await tx.usuario.create({
          data: {
            nombre: eNombre,
            email: eEmail,
            passwordHash,
            rol: 'LIDER_AREA',
            areaId: area.id,
            activo,
          },
          select: { id: true },
        })
      }

      await registrarMovimiento(tx, {
        area,
        tipo: 'CREADA',
        detalle: esSubarea
          ? `Subárea creada bajo ${padre.nombre} (${padre.codigo}).`
          : `Área operativa creada bajo ${padre.nombre} (${padre.codigo})${conEncargado ? ' con su encargado' : ''}.`,
        padreNombre: padre.nombre,
        usuario,
      })

      return area
    })
  },

  /**
   * Edita código/nombre de un área.
   * El área líder (raíz) no se modifica: ancla la jerarquía.
   */
  async actualizarArea(usuario, id, datos) {
    if (!esLiderGeneral(usuario)) {
      throw { status: 403, message: 'Solo gerencia puede estructurar las áreas.' }
    }

    const area = await prisma.area.findUnique({ where: { id } })
    if (!area) throw { status: 404, message: 'El área no existe.' }
    if (!area.parentId) {
      throw { status: 400, message: 'El área líder no se puede modificar.' }
    }

    const cambios = {}
    if (datos.nombre !== undefined) {
      const nombre = datos.nombre.trim()
      if (!nombre) throw { status: 400, message: 'El nombre del área es obligatorio.' }
      cambios.nombre = nombre
    }
    if (datos.codigo !== undefined) {
      const codigo = datos.codigo.trim().toUpperCase()
      if (!codigo) throw { status: 400, message: 'El código del área es obligatorio.' }
      cambios.codigo = codigo
    }
    if (!Object.keys(cambios).length) {
      throw { status: 400, message: 'No hay cambios para el área.' }
    }

    // Duplicados contra OTRAS áreas (nombre y código son únicos)
    const donde = { id: { not: id }, OR: [] }
    if (cambios.nombre) donde.OR.push({ nombre: cambios.nombre })
    if (cambios.codigo) donde.OR.push({ codigo: cambios.codigo })
    const repetida = await prisma.area.findFirst({ where: donde })
    if (repetida) {
      throw repetida.nombre === cambios.nombre
        ? { status: 409, message: `Ya existe un área llamada "${cambios.nombre}".` }
        : { status: 409, message: `El código ${cambios.codigo} ya lo usa el área ${repetida.nombre}.` }
    }

    const padre = area.parentId
      ? await prisma.area.findUnique({ where: { id: area.parentId } })
      : null

    return prisma.$transaction(async (tx) => {
      const actualizada = await tx.area.update({
        where: { id },
        data: cambios,
        select: { id: true, nombre: true, codigo: true, parentId: true },
      })

      const partes = []
      if (cambios.nombre && cambios.nombre !== area.nombre) {
        partes.push(`nombre: "${area.nombre}" → "${cambios.nombre}"`)
      }
      if (cambios.codigo && cambios.codigo !== area.codigo) {
        partes.push(`código: ${area.codigo} → ${cambios.codigo}`)
      }
      await registrarMovimiento(tx, {
        area: actualizada,
        tipo: 'ACTUALIZADA',
        detalle: partes.join(' · '),
        padreNombre: padre?.nombre || null,
        usuario,
      })

      return actualizada
    })
  },

  /**
   * Activa o desactiva un área (línea verde/roja del mapa de estructura).
   * Desactivar un área no borra nada: sus radicados y usuarios quedan como
   * están; el mapa pinta su línea (y la de sus subáreas) en rojo porque el
   * funcionamiento depende de la cadena completa de áreas activas.
   * El área líder (gerencia) está siempre activa: ancla la jerarquía.
   */
  async cambiarEstadoArea(usuario, id, activa) {
    if (!esLiderGeneral(usuario)) {
      throw { status: 403, message: 'Solo gerencia puede estructurar las áreas.' }
    }

    const area = await prisma.area.findUnique({ where: { id } })
    if (!area) throw { status: 404, message: 'El área no existe.' }
    if (!area.parentId) {
      throw { status: 400, message: 'El área líder (gerencia) está siempre activa.' }
    }

    const estadoActual = area.activa !== false
    if (estadoActual === activa) {
      throw {
        status: 400,
        message: `El área ya está ${activa ? 'activa' : 'inactiva'}.`,
      }
    }

    const subareas = await prisma.area.count({ where: { parentId: id } })

    return prisma.$transaction(async (tx) => {
      const actualizada = await tx.area.update({
        where: { id },
        data: { activa },
        select: { id: true, nombre: true, codigo: true, parentId: true },
      })

      let detalle = activa
        ? 'Área activada: vuelve a funcionar (línea verde).'
        : 'Área desactivada: deja de funcionar (línea roja).'
      if (!activa && subareas > 0) {
        detalle += ` Sus ${subareas} subárea(s) dependientes también quedan sin funcionamiento.`
      }

      const padre = area.parentId
        ? await tx.area.findUnique({ where: { id: area.parentId } })
        : null

      await registrarMovimiento(tx, {
        area: actualizada,
        tipo: activa ? 'ACTIVADA' : 'DESACTIVADA',
        detalle,
        padreNombre: padre?.nombre || null,
        usuario,
      })

      return { ...actualizada, activa }
    })
  },

  /**
   * Elimina un área VACÍA: sin usuarios, radicados ni subáreas.
   * El área líder y las áreas con contenido quedan protegidas (los usuarios
   * y radicados dependen del área con onDelete: Restrict).
   * El movimiento ELIMINADA queda registrado: la auditoría sobrevive al área.
   */
  async eliminarArea(usuario, id) {
    if (!esLiderGeneral(usuario)) {
      throw { status: 403, message: 'Solo gerencia puede estructurar las áreas.' }
    }

    const area = await prisma.area.findUnique({ where: { id } })
    if (!area) throw { status: 404, message: 'El área no existe.' }
    if (!area.parentId) {
      throw { status: 400, message: 'El área líder no se puede eliminar.' }
    }

    const [usuarios, radicados, subareas] = await Promise.all([
      prisma.usuario.count({ where: { areaId: id } }),
      prisma.radicado.count({ where: { areaId: id } }),
      prisma.area.count({ where: { parentId: id } }),
    ])
    if (subareas > 0) {
      throw {
        status: 409,
        message: `No se puede eliminar ${area.nombre}: tiene ${subareas} subárea(s) dependiente(s). Elimine o reubique las subáreas primero.`,
      }
    }
    if (usuarios > 0) {
      throw {
        status: 409,
        message: `No se puede eliminar ${area.nombre}: tiene ${usuarios} usuario(s) asignado(s). Reasígnelos a otra área primero.`,
      }
    }
    if (radicados > 0) {
      throw {
        status: 409,
        message: `No se puede eliminar ${area.nombre}: tiene ${radicados} radicado(s) registrado(s).`,
      }
    }

    await prisma.$transaction(async (tx) => {
      await registrarMovimiento(tx, {
        area,
        tipo: 'ELIMINADA',
        detalle: `Área eliminada del mapa de estructura.${area.activa === false ? ' Estaba inactiva.' : ''}`,
        padreNombre: null,
        usuario,
      })
      await tx.area.delete({ where: { id } })
    })

    return { id: area.id, nombre: area.nombre, codigo: area.codigo }
  },

  /**
   * Registro del movimiento de las áreas (auditoría del mapa de estructura).
   * Solo gerencia. areaId opcional filtra la historia de un área concreta;
   * el registro sobrevive a las áreas eliminadas (snapshots congelados).
   */
  async listarMovimientos(usuario, { areaId, limite } = {}) {
    if (!esLiderGeneral(usuario)) {
      throw { status: 403, message: 'Solo gerencia puede ver el registro de movimientos.' }
    }

    const donde = {}
    if (areaId) donde.areaId = areaId

    const tomar = Math.min(Math.max(Number(limite) || 100, 1), 200)
    return prisma.movimientoArea.findMany({
      where: donde,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: tomar,
    })
  },
}
